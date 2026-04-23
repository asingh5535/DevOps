import React, { useState } from 'react'
import {
  Card, Form, Input, Button, Tabs, Alert, Typography, Space, Divider, message,
} from 'antd'
import {
  ApiOutlined, KeyOutlined, FileTextOutlined, CloudServerOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { authApi } from '@/services/api'
import { useAuthStore } from '@/store/auth'
import type { LoginResponse } from '@/types'

const { Title, Text, Link } = Typography

export default function Login() {
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [tokenForm] = Form.useForm()
  const [kubeconfigForm] = Form.useForm()

  async function handleTokenLogin(values: { serverUrl: string; token: string }) {
    setLoading(true)
    setError('')
    try {
      const res = await authApi.login({
        auth_type: 'token',
        server_url: values.serverUrl,
        token: values.token,
      })
      const data = res.data as LoginResponse
      login(data.access_token, data.server_version, data.server_url)
      message.success('Connected to Kubernetes cluster ' + data.server_version)
      navigate('/dashboard')
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      setError(e?.response?.data?.error ?? 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  async function handleKubeconfigLogin(values: { kubeconfig: string }) {
    setLoading(true)
    setError('')
    try {
      const b64 = btoa(values.kubeconfig)
      const res = await authApi.login({
        auth_type: 'kubeconfig',
        kubeconfig_b64: b64,
      })
      const data = res.data as LoginResponse
      login(data.access_token, data.server_version, data.server_url)
      message.success('Connected to Kubernetes cluster ' + data.server_version)
      navigate('/dashboard')
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      setError(e?.response?.data?.error ?? 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  async function handleInClusterLogin() {
    setLoading(true)
    setError('')
    try {
      const res = await authApi.login({ auth_type: 'incluster' })
      const data = res.data as LoginResponse
      login(data.access_token, data.server_version, data.server_url)
      message.success('Connected via in-cluster config')
      navigate('/dashboard')
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      setError(e?.response?.data?.error ?? 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0a0a0a 0%, #0d1117 50%, #0a0a14 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{ width: '100%', maxWidth: 480 }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 64, height: 64,
            background: 'linear-gradient(135deg, #1677ff, #0958d9)',
            borderRadius: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 36, margin: '0 auto 16px',
            boxShadow: '0 0 40px rgba(22,119,255,0.3)',
          }}>
            ☸
          </div>
          <Title level={2} style={{ color: '#e6edf3', margin: 0 }}>KubeVision</Title>
          <Text style={{ color: '#8b949e' }}>Enterprise Kubernetes Management Platform</Text>
        </div>

        <Card
          style={{
            background: '#161b22',
            border: '1px solid #21262d',
            borderRadius: 12,
          }}
          styles={{ body: { padding: 32 } }}
        >
          {error && (
            <Alert
              message={error}
              type="error"
              showIcon
              closable
              onClose={() => setError('')}
              style={{ marginBottom: 20 }}
            />
          )}

          <Tabs
            defaultActiveKey="token"
            items={[
              {
                key: 'token',
                label: (
                  <Space><KeyOutlined /> Bearer Token</Space>
                ),
                children: (
                  <Form form={tokenForm} layout="vertical" onFinish={handleTokenLogin}>
                    <Form.Item
                      name="serverUrl"
                      label={<span style={{ color: '#cdd9e5' }}>Kubernetes API Server URL</span>}
                      rules={[{ required: true, message: 'Server URL is required' }]}
                    >
                      <Input
                        prefix={<CloudServerOutlined style={{ color: '#8b949e' }} />}
                        placeholder="https://127.0.0.1:6443"
                        style={{ background: '#0d1117', borderColor: '#30363d', color: '#e6edf3' }}
                      />
                    </Form.Item>
                    <Form.Item
                      name="token"
                      label={<span style={{ color: '#cdd9e5' }}>Service Account Token</span>}
                      rules={[{ required: true, message: 'Token is required' }]}
                    >
                      <Input.TextArea
                        placeholder="eyJhbGciOiJSUzI1NiIs..."
                        rows={4}
                        style={{ background: '#0d1117', borderColor: '#30363d', color: '#e6edf3', fontFamily: 'monospace', fontSize: 11 }}
                      />
                    </Form.Item>
                    <Button
                      type="primary" htmlType="submit" block size="large"
                      loading={loading} icon={<ApiOutlined />}
                    >
                      Connect with Token
                    </Button>
                  </Form>
                ),
              },
              {
                key: 'kubeconfig',
                label: (
                  <Space><FileTextOutlined /> Kubeconfig</Space>
                ),
                children: (
                  <Form form={kubeconfigForm} layout="vertical" onFinish={handleKubeconfigLogin}>
                    <Form.Item
                      name="kubeconfig"
                      label={<span style={{ color: '#cdd9e5' }}>Kubeconfig Content</span>}
                      rules={[{ required: true, message: 'Kubeconfig is required' }]}
                      extra={<Text style={{ color: '#8b949e', fontSize: 12 }}>Paste your ~/.kube/config content</Text>}
                    >
                      <Input.TextArea
                        placeholder="apiVersion: v1&#10;clusters:&#10;..."
                        rows={10}
                        style={{ background: '#0d1117', borderColor: '#30363d', color: '#e6edf3', fontFamily: 'monospace', fontSize: 11 }}
                      />
                    </Form.Item>
                    <Button
                      type="primary" htmlType="submit" block size="large"
                      loading={loading} icon={<FileTextOutlined />}
                    >
                      Connect with Kubeconfig
                    </Button>
                  </Form>
                ),
              },
              {
                key: 'incluster',
                label: (
                  <Space><CloudServerOutlined /> In-Cluster</Space>
                ),
                children: (
                  <div>
                    <Alert
                      message="In-Cluster Authentication"
                      description="Connect using the service account mounted in the pod. Only works when KubeVision itself is running inside a Kubernetes cluster."
                      type="info"
                      showIcon
                      style={{ marginBottom: 20 }}
                    />
                    <Button
                      type="primary" block size="large"
                      loading={loading}
                      icon={<CloudServerOutlined />}
                      onClick={handleInClusterLogin}
                    >
                      Connect via In-Cluster Config
                    </Button>
                  </div>
                ),
              },
            ]}
          />
        </Card>

        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <Text style={{ color: '#8b949e', fontSize: 12 }}>
            KubeVision respects your cluster RBAC policies.
          </Text>
        </div>
      </div>
    </div>
  )
}
