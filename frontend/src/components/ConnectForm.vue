<template>
  <el-card class="connect-card" shadow="never">
    <template #header>
      <div class="card-header">
        <span class="title">服务器连接信息</span>
      </div>
    </template>

    <el-form :model="form" :rules="rules" ref="formRef" label-width="110px" label-position="right">
      <el-form-item label="服务器地址" prop="host">
        <el-input v-model="form.host" placeholder="例如 1.2.3.4 或 example.com" clearable />
      </el-form-item>

      <el-form-item label="SSH 端口" prop="port">
        <el-input-number v-model="form.port" :min="1" :max="65535" controls-position="right" />
      </el-form-item>

      <el-form-item label="登录用户名" prop="username">
        <el-input v-model="form.username" placeholder="默认 root" clearable />
      </el-form-item>

      <el-form-item label="认证方式" prop="authType">
        <el-radio-group v-model="form.authType">
          <el-radio-button value="password">密码</el-radio-button>
          <el-radio-button value="key">私钥</el-radio-button>
        </el-radio-group>
      </el-form-item>

      <el-form-item v-if="form.authType === 'password'" label="登录密码" prop="password">
        <el-input v-model="form.password" type="password" show-password placeholder="服务器登录密码" />
      </el-form-item>

      <template v-else>
        <el-form-item label="私钥" prop="privateKey">
          <el-input
            v-model="form.privateKey"
            type="textarea"
            :rows="5"
            placeholder="粘贴私钥内容，或以 -----BEGIN 开头的完整私钥"
          />
          <div class="upload-row">
            <input ref="fileInput" type="file" accept=".pem,.key,.txt" style="display:none" @change="onFileChange" />
            <el-button size="small" @click="pickFile">选择私钥文件</el-button>
            <span class="file-name" v-if="fileName">{{ fileName }}</span>
          </div>
        </el-form-item>

        <el-form-item label="私钥口令">
          <el-input v-model="form.passphrase" type="password" show-password placeholder="如私钥无口令可留空" />
        </el-form-item>
      </template>

      <el-form-item>
        <div class="btn-row">
          <el-button
            type="primary"
            plain
            :loading="testing"
            :disabled="installing"
            @click="onTest"
          >测试连接</el-button>

          <el-button
            type="success"
            :loading="installing"
            :disabled="testing"
            @click="onStart"
          >一键搭建</el-button>
        </div>
      </el-form-item>
    </el-form>
  </el-card>
</template>

<script setup>
import { reactive, ref } from 'vue'

const props = defineProps({
  testing: { type: Boolean, default: false },
  installing: { type: Boolean, default: false }
})
const emit = defineEmits(['test', 'start'])

const formRef = ref(null)
const fileInput = ref(null)
const fileName = ref('')

const form = reactive({
  host: '',
  port: 22,
  username: 'root',
  authType: 'password',
  password: '',
  privateKey: '',
  passphrase: ''
})

function validatePassword(rule, value, cb) {
  if (form.authType === 'password' && !value) cb(new Error('请输入登录密码'))
  else cb()
}
function validateKey(rule, value, cb) {
  if (form.authType === 'key' && !value) cb(new Error('请粘贴或选择私钥'))
  else cb()
}

const rules = {
  host: [{ required: true, message: '请输入服务器地址', trigger: 'blur' }],
  port: [{ required: true, message: '请输入 SSH 端口', trigger: 'blur' }],
  username: [{ required: true, message: '请输入登录用户名', trigger: 'blur' }],
  password: [{ validator: validatePassword, trigger: 'blur' }],
  privateKey: [{ validator: validateKey, trigger: 'blur' }]
}

function buildPayload() {
  const p = {
    host: form.host.trim(),
    port: form.port,
    username: form.username.trim()
  }
  if (form.authType === 'password') {
    p.password = form.password
  } else {
    p.privateKey = form.privateKey
    p.passphrase = form.passphrase
  }
  return p
}

async function validate() {
  if (!formRef.value) return false
  try {
    await formRef.value.validate()
    return true
  } catch (e) {
    return false
  }
}

async function onTest() {
  if (!(await validate())) return
  emit('test', buildPayload())
}

async function onStart() {
  if (!(await validate())) return
  emit('start', buildPayload())
}

function pickFile() {
  fileInput.value && fileInput.value.click()
}

function onFileChange(e) {
  const f = e.target.files && e.target.files[0]
  if (!f) return
  fileName.value = f.name
  const reader = new FileReader()
  reader.onload = () => { form.privateKey = reader.result }
  reader.readAsText(f)
}
</script>

<style scoped>
.card-header { display: flex; align-items: center; }
.title { font-size: 16px; font-weight: 600; color: #303133; }
.btn-row { display: flex; gap: 12px; width: 100%; }
.upload-row { margin-top: 8px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.file-name { font-size: 12px; color: #909399; word-break: break-all; }

/* 手机端 */
@media (max-width: 768px) {
  .title { font-size: 15px; }
  .btn-row { gap: 10px; }
  .btn-row .el-button {
    flex: 1 1 0;
    margin-left: 0 !important;
    min-height: 42px;
    font-size: 15px;
  }
  :deep(.el-radio-group) {
    display: flex;
    width: 100%;
  }
  :deep(.el-radio-button) {
    flex: 1 1 0;
  }
  :deep(.el-radio-button__inner) {
    width: 100%;
    padding: 10px 0;
    font-size: 14px;
  }
  :deep(.el-textarea__inner) {
    font-size: 13px;
  }
  .file-name { flex-basis: 100%; }
}
</style>
