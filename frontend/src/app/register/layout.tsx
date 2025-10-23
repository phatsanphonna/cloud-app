import { NoAuthProvider } from '@/lib/user'
import { FC } from 'react'

interface Props {
  children: React.ReactNode
}

const RegisterLayout: FC<Props> = ({ children }) => {
  return (
    <NoAuthProvider>
      {children}
    </NoAuthProvider>
  )
}

export default RegisterLayout