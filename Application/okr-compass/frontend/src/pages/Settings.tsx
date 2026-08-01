import { Typography, Card, Descriptions } from 'antd'
import { useAuthStore } from '@/store/auth'

const { Title, Paragraph } = Typography

export default function Settings() {
  const username = useAuthStore((s) => s.username)

  return (
    <div>
      <Title level={3}>Settings</Title>
      <Card title="Session">
        <Descriptions column={1}>
          <Descriptions.Item label="Signed in as">{username}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="Deployment configuration" style={{ marginTop: 16 }}>
        <Paragraph type="secondary">
          OKR Compass is configured entirely through backend environment variables (see the
          project&apos;s <code>.env.example</code>) — there is no in-app settings store for these,
          since they gate credential encryption and admin login:
        </Paragraph>
        <Descriptions column={1} bordered size="small">
          <Descriptions.Item label="EVAL_INTERVAL_MINUTES">
            How often every Key Result's bound metric is re-evaluated in the background.
          </Descriptions.Item>
          <Descriptions.Item label="ENCRYPTION_KEY">
            32-byte AES-256-GCM key used to encrypt cluster credentials at rest.
          </Descriptions.Item>
          <Descriptions.Item label="ADMIN_USER / ADMIN_PASSWORD">
            Single admin login used to sign in to this UI.
          </Descriptions.Item>
          <Descriptions.Item label="JWT_SECRET">
            Signs session tokens issued on login.
          </Descriptions.Item>
        </Descriptions>
      </Card>
    </div>
  )
}
