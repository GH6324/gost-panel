import { createApp } from 'vue'
import { createPinia } from 'pinia'
import naive from 'naive-ui'
import App from './App.vue'
import router from './router'
import './style.css'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(naive)

// 确保路由准备好后再挂载
router.isReady().then(() => {
  app.mount('#app')
})
