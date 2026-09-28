<template>
  <el-card class="log-card" shadow="never">
    <template #header>
      <div class="card-header">
        <span class="title">搭建过程日志</span>
        <div class="header-actions">
          <el-tag :type="statusTagType" size="small" effect="light">{{ statusText }}</el-tag>
          <el-button size="small" text @click="togglePause">{{ paused ? '继续滚动' : '暂停滚动' }}</el-button>
          <el-button size="small" text @click="copyAll">复制全部</el-button>
          <el-button size="small" text @click="downloadLog">下载日志</el-button>
          <el-button size="small" text @click="clearLog">清空</el-button>
        </div>
      </div>
    </template>

    <div ref="termRef" class="terminal">
      <div v-if="lines.length === 0" class="empty-tip">日志将在开始搭建后实时显示于此</div>
      <div
        v-for="(line, idx) in lines"
        :key="idx"
        class="term-line"
        :class="line.stream"
      >{{ line.text }}</div>
    </div>
  </el-card>
</template>

<script setup>
import { ref, computed, nextTick, watch } from 'vue'

const props = defineProps({
  lines: { type: Array, default: () => [] },
  phase: { type: String, default: 'idle' }
})

const termRef = ref(null)
const paused = ref(false)

const statusMap = {
  idle: { text: '待机', type: 'info' },
  connecting: { text: '连接中', type: 'warning' },
  connected: { text: '已连接', type: 'success' },
  testing: { text: '测试中', type: 'warning' },
  testFailed: { text: '连接失败', type: 'danger' },
  params: { text: '生成参数', type: 'warning' },
  upload: { text: '上传脚本', type: 'warning' },
  installing: { text: '安装中', type: 'warning' },
  result: { text: '读取结果', type: 'warning' },
  done: { text: '安装完成', type: 'success' },
  error: { text: '出错', type: 'danger' }
}

const statusText = computed(() => (statusMap[props.phase] || statusMap.idle).text)
const statusTagType = computed(() => (statusMap[props.phase] || statusMap.idle).type)

watch(
  () => props.lines.length,
  () => {
    if (paused.value) return
    nextTick(() => {
      const el = termRef.value
      if (el) el.scrollTop = el.scrollHeight
    })
  }
)

function togglePause() { paused.value = !paused.value }

function clearLog() { props.lines.splice(0, props.lines.length) }

function copyAll() {
  const text = props.lines.map((l) => l.text).join('')
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text)
  } else {
    const ta = document.createElement('textarea')
    ta.value = text
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
  }
}

function downloadLog() {
  const text = props.lines.map((l) => l.text).join('')
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'install-log.txt'
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<style scoped>
.card-header { display: flex; align-items: center; justify-content: space-between; }
.title { font-size: 16px; font-weight: 600; color: #303133; }
.header-actions { display: flex; align-items: center; gap: 6px; }
.terminal {
  height: 380px;
  overflow-y: auto;
  background: #0d1117;
  border-radius: 6px;
  padding: 12px 14px;
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
  font-size: 13px;
  line-height: 1.6;
  -webkit-overflow-scrolling: touch;
}
.term-line { white-space: pre-wrap; word-break: break-all; color: #c9d1d9; }
.term-line.stderr { color: #ff7b72; }
.empty-tip { color: #6e7681; text-align: center; padding-top: 150px; font-size: 13px; }

/* 手机端 */
@media (max-width: 768px) {
  .card-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  .title { font-size: 15px; }
  .header-actions {
    flex-wrap: wrap;
    gap: 4px;
    width: 100%;
  }
  .header-actions .el-button {
    min-height: 32px;
    padding: 6px 8px;
    font-size: 13px;
  }
  .terminal {
    height: 52vh;
    min-height: 240px;
    max-height: 420px;
    font-size: 12px;
    padding: 10px 12px;
  }
  .empty-tip { padding-top: 90px; }
}
</style>
