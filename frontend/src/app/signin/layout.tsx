import { NoAuthProvider } from '@/lib/user'
import { FC } from 'react'

interface Props {
  children: React.ReactNode
}

const LoginLayout: FC<Props> = ({ children }) => {
  return (
    <NoAuthProvider>
      {children}
    </NoAuthProvider>
  )
}

export default LoginLayout