<template>
  <div class="page">
    <header class="page-header">
      <div class="brand">
        <svg class="brand-icon" viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
          <path d="M12 2 3 7v6c0 5 3.8 8.4 9 9 5.2-.6 9-4 9-9V7l-9-5z" fill="none" stroke="#409eff" stroke-width="1.6" stroke-linejoin="round"/>
          <path d="M9.5 9.5v5l4.2-2.5-4.2-2.5z" fill="#409eff"/>
        </svg>
        <div>
          <h1>3X-UI 一键搭建平台</h1>
          <p>输入服务器信息，自动生成随机参数，一键完成 3X-UI 面板部署</p>
        </div>
      </div>
    </header>

    <el-card class="steps-card" shadow="never">
      <el-steps :active="activeStep" align-center finish-status="success">
        <el-step title="填写信息" />
        <el-step title="测试连接" />
        <el-step title="自动安装" />
        <el-step title="获取结果" />
      </el-steps>
    </el-card>

    <div class="grid">
      <div class="col-left">
        <ConnectForm
          :testing="testing"
          :installing="installing"
          @test="handleTest"
          @start="handleStart"
        />
        <ResultCard :result="result" />
      </div>

      <div class="col-right">
        <TerminalLog :lines="lines" :phase="phase" />

        <el-card class="progress-card" shadow="never">
          <div class="progress-head">
            <span class="progress-label">{{ statusMessage }}</span>
            <span class="progress-percent">{{ progress }}%</span>
          </div>
          <el-progress :percentage="progress" :stroke-width="10" :show-text="false" />
        </el-card>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onBeforeUnmount } from 'vue'
import { ElMessage } from 'element-plus'
import ConnectForm from '../components/ConnectForm.vue'
import TerminalLog from '../components/TerminalLog.vue'
import ResultCard from '../components/ResultCard.vue'
import { createSocket } from '../utils/ws'

const testing = ref(false)
const installing = ref(false)
const phase = ref('idle')
const statusMessage = ref('待机中')
const progress = ref(0)
const activeStep = ref(0)
const result = ref(null)
const lines = reactive([])

const phaseProgress = {
  idle: 0,
  testing: 10,
  connecting: 20,
  connected: 30,
  params: 40,
  upload: 50,
  installing: 60,
  result: 90,
  done: 100,
  error: 100,
  testFailed: 0
}

const phaseStep = {
  idle: 0,
  testing: 1,
  connecting: 1,
  connected: 2,
  params: 2,
  upload: 2,
  installing: 2,
  result: 3,
  done: 4,
  error: 0,
  testFailed: 1
}

let socket = null
let testTimer = null

function ensureSocket() {
  if (socket) return socket
  socket = createSocket({
    onOpen: () => {
      pushLog('stdout', '[前端] WebSocket 已就绪\n')
    },
    onClose: () => {
      if (installing.value || testing.value) {
        statusMessage.value = '连接已断开，正在重连...'
      }
    },
    onError: () => {
      pushLog('stderr', '[前端] WebSocket 连接错误\n')
    },
    onMessage: handleMessage
  })
  return socket
}

function pushLog(stream, text) {
  lines.push({ stream, text })
}

function handleMessage(msg) {
  const { type, data } = msg || {}

  if (type === 'hello') {
    pushLog('stdout', '[前端] 已连接后端服务\n')
    return
  }

  if (type === 'log') {
    lines.push({ stream: data.stream || 'stdout', text: data.text || '' })
    if (phase.value === 'installing' && progress.value < 88) {
      progress.value = Math.min(progress.value + 0.6, 88)
    }
    return
  }

  if (type === 'status') {
    const p = data.phase
    if (p) {
      phase.value = p
      activeStep.value = phaseStep[p] != null ? phaseStep[p] : activeStep.value
      if (phaseProgress[p] != null) progress.value = phaseProgress[p]
    }
    if (data.message) statusMessage.value = data.message

    if (p === 'done') {
      installing.value = false
      testing.value = false
      clearTestTimer()
      activeStep.value = 4
      ElMessage.success('搭建完成')
    }
    if (p === 'error' || p === 'testFailed') {
      installing.value = false
      testing.value = false
      clearTestTimer()
      ElMessage.error(data.message || '操作失败')
    }
    return
  }

  if (type === 'testResult') {
    testing.value = false
    clearTestTimer()
    if (data.ok) {
      ElMessage.success('连接成功：' + String(data.info || '').split('\n')[0])
      activeStep.value = 2
      pushLog('stdout', '[前端] 连接测试通过\n')
    } else {
      ElMessage.error('连接失败：' + data.message)
      activeStep.value = 1
      pushLog('stderr', '[前端] 连接测试失败：' + data.message + '\n')
    }
    return
  }

  if (type === 'result') {
    result.value = data
    progress.value = 100
    phase.value = 'done'
    activeStep.value = 4
    statusMessage.value = '搭建完成，请保存面板信息'
    installing.value = false
    testing.value = false
    clearTestTimer()
    return
  }

  if (type === 'error') {
    installing.value = false
    testing.value = false
    clearTestTimer()
    ElMessage.error(data.message || '发生错误')
    return
  }
}

function clearTestTimer() {
  if (testTimer) { clearTimeout(testTimer); testTimer = null }
}

function resetBeforeRun() {
  lines.splice(0, lines.length)
  result.value = null
  progress.value = 0
  phase.value = 'idle'
  statusMessage.value = '准备中...'
  activeStep.value = 1
}

function handleTest(payload) {
  const s = ensureSocket()
  testing.value = true
  resetBeforeRun()
  statusMessage.value = '正在测试连接...'
  pushLog('stdout', '[前端] 发送连接测试请求\n')
  s.send('test', payload)

  clearTestTimer()
  testTimer = setTimeout(() => {
    if (!testing.value) return
    testing.value = false
    statusMessage.value = '测试超时：后端无响应'
    ElMessage.error('测试超时（16 秒无响应）。请确认后端服务是否正常运行，或查看后端日志。')
    pushLog('stderr', '[前端] 测试超时，未收到后端响应\n')
  }, 16000)
}

function handleStart(payload) {
  const s = ensureSocket()
  installing.value = true
  resetBeforeRun()
  statusMessage.value = '正在开始搭建...'
  pushLog('stdout', '[前端] 发送安装请求\n')
  s.send('start', payload)
}

onBeforeUnmount(() => {
  clearTestTimer()
  if (socket) socket.close()
})
</script>

<style scoped>
.page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px 16px 48px;
  padding-bottom: calc(48px + env(safe-area-inset-bottom));
}
.page-header { margin-bottom: 20px; }
.brand { display: flex; align-items: center; gap: 14px; }
.brand-icon { flex-shrink: 0; }
.brand h1 { margin: 0; font-size: 22px; color: #1f2d3d; }
.brand p { margin: 4px 0 0; font-size: 13px; color: #909399; }
.steps-card { margin-bottom: 20px; }
.grid { display: grid; grid-template-columns: minmax(360px, 440px) 1fr; gap: 20px; align-items: start; }
.col-left, .col-right { display: flex; flex-direction: column; gap: 20px; }
.progress-card { margin-top: 0; }
.progress-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.progress-label { font-size: 14px; color: #606266; }
.progress-percent { font-size: 14px; font-weight: 600; color: #409eff; }

/* 平板 / 手机：单列布局 */
@media (max-width: 900px) {
  .grid { grid-template-columns: 1fr; gap: 14px; }
  .col-left, .col-right { gap: 14px; }
}

/* 手机端细节 */
@media (max-width: 768px) {
  .page {
    padding: 14px 10px calc(28px + env(safe-area-inset-bottom));
  }
  .page-header { margin-bottom: 14px; }
  .brand { gap: 10px; align-items: flex-start; }
  .brand-icon { width: 22px; height: 22px; margin-top: 3px; }
  .brand h1 { font-size: 17px; line-height: 1.3; }
  .brand p { font-size: 12px; line-height: 1.4; }
  .steps-card { margin-bottom: 14px; }
  .progress-head { margin-bottom: 8px; }
  .progress-label { font-size: 13px; }
  .progress-percent { font-size: 13px; }
}
</style>
