'use client';
import { useRouter } from 'next/navigation';
import LoginForm from '@/components/shared/LoginForm';

export default function SalesLoginPage() {
  const router = useRouter();

  return (
    <LoginForm
      role="sales"
      loginRole="sales"
      googleRole="sales"
      allowedRoles={['sales']}
      title="Sales Agent"
      subtitle="Onboard hotels & earn commission"
      icon="💼"
      registerLink="/sales/register"
      registerText="Become a sales partner"
      onSuccess={() => router.replace('/sales')}
    />
  );
}
