'use client';
import { useRouter } from 'next/navigation';
import LoginForm from '@/components/shared/LoginForm';

export default function UserLoginPage() {
  const router = useRouter();

  return (
    <LoginForm
      role="user"
      allowedRoles={['user']}
      title="PREMO"
      subtitle="Hotel Booking Platform"
      icon="🏨"
      registerLink="/user/register"
      registerText="Register here"
      forgotLink="/forgot-password?role=user"
      googleRole="user"
      onSuccess={() => {
        const redirectTo = new URLSearchParams(window.location.search).get('redirect');
        router.replace(redirectTo || '/user');
      }}
    />
  );
}
