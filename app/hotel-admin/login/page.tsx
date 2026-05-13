'use client';
import { useRouter } from 'next/navigation';
import LoginForm from '@/components/shared/LoginForm';

export default function HotelAdminLoginPage() {
  const router = useRouter();

  return (
    <LoginForm
      role="hotel-admin"
      allowedRoles={['hotel']}
      title="Hotel Admin"
      subtitle="Manage your hotel property"
      icon="🏩"
      registerLink="/hotel-admin/register"
      registerText="Register your hotel"
      forgotLink="/forgot-password?role=hotel"
      loginRole="hotel"
      googleRole="hotel"
      onSuccess={() => router.replace('/hotel-admin')}
    />
  );
}
