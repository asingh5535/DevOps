import React from 'react'
import ReactDOM from 'react-dom/client'
import { ConfigProvider, theme } from 'antd'
import App from './App'
import 'antd/dist/reset.css'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: '#1677ff',
          borderRadius: 6,
          colorBgContainer: '#141414',
          colorBgLayout: '#0a0a0a',
        },
        components: {
          Layout: {
            siderBg: '#0d1117',
            headerBg: '#0d1117',
            bodyBg: '#0a0a0a',
          },
          Menu: {
            darkItemBg: '#0d1117',
            darkSubMenuItemBg: '#0d1117',
          },
          Table: {
            headerBg: '#1a1a2e',
          },
        },
      }}
    >
      <App />
    </ConfigProvider>
  </React.StrictMode>
)
