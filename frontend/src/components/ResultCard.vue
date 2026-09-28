<template>
  <el-card v-if="result" class="result-card" shadow="never">
    <template #header>
      <div class="card-header">
        <span class="title">安装结果</span>
        <el-tag type="success" size="small">搭建成功</el-tag>
      </div>
    </template>

    <el-descriptions :column="1" border size="default">
      <el-descriptions-item label="面板地址">
        <div class="value-row">
          <a :href="result.accessUrl" target="_blank" rel="noopener" class="url">{{ result.accessUrl }}</a>
          <el-button size="small" text @click="copy(result.accessUrl)">复制</el-button>
        </div>
      </el-descriptions-item>
      <el-descriptions-item label="用户名">
        <div class="value-row">
          <span class="mono">{{ result.username }}</span>
          <el-button size="small" text @click="copy(result.username)">复制</el-button>
        </div>
      </el-descriptions-item>
      <el-descriptions-item label="密码">
        <div class="value-row">
          <span class="mono">{{ showPwd ? result.password : '••••••••••••' }}</span>
          <el-button size="small" text @click="showPwd = !showPwd">{{ showPwd ? '隐藏' : '显示' }}</el-button>
          <el-button size="small" text @click="copy(result.password)">复制</el-button>
        </div>
      </el-descriptions-item>
      <el-descriptions-item label="面板端口">
        <span class="mono">{{ result.panelPort }}</span>
      </el-descriptions-item>
      <el-descriptions-item label="Web 路径">
        <span class="mono">{{ result.webBasePath }}</span>
      </el-descriptions-item>
      <el-descriptions-item v-if="result.dbType" label="数据库类型">
        <span class="mono">{{ result.dbType }}</span>
      </el-descriptions-item>
      <el-descriptions-item v-if="result.apiToken" label="API Token">
        <div class="value-row">
          <span class="mono">{{ result.apiToken }}</span>
          <el-button size="small" text @click="copy(result.apiToken)">复制</el-button>
        </div>
      </el-descriptions-item>
    </el-descriptions>

    <el-alert
      class="tip"
      type="warning"
      :closable="false"
      show-icon
      title="请立即保存以上信息"
      description="面板地址包含随机访问路径，关闭页面后将不再显示。如遗忘可在服务器执行 cat /etc/x-ui/install-result.env 查看。"
    />
  </el-card>
</template>

<script setup>
import { ref } from 'vue'

defineProps({
  result: { type: Object, default: null }
})

const showPwd = ref(false)

function copy(text) {
  if (!text) return
  if (navigator.clipboard) {
    navigator.clipboard.writeText(String(text))
  } else {
    const ta = document.createElement('textarea')
    ta.value = String(text)
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
  }
}
</script>

<style scoped>
.card-header { display: flex; align-items: center; justify-content: space-between; }
.title { font-size: 16px; font-weight: 600; color: #303133; }
.value-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.url { color: #409eff; text-decoration: none; word-break: break-all; }
.url:hover { text-decoration: underline; }
.mono { font-family: "SFMono-Regular", Consolas, Menlo, monospace; }
.tip { margin-top: 16px; }

/* 手机端 */
@media (max-width: 768px) {
  .card-header { gap: 8px; }
  .title { font-size: 15px; }
  .value-row { gap: 6px; row-gap: 4px; }
  .value-row .el-button {
    margin-left: 0 !important;
    padding: 0 4px;
    height: auto;
    min-height: 26px;
    font-size: 12px;
  }
  .mono { font-size: 13px; word-break: break-all; }
  .url { font-size: 13px; }
  .tip { margin-top: 12px; }
  :deep(.el-descriptions__body) { font-size: 13px; }
}
</style>
