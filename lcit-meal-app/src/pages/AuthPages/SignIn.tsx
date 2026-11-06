import PageMeta from "../../components/common/PageMeta";
import AuthLayout from "./AuthPageLayout";
import SignInForm from "../../components/auth/SignInForm";

export default function SignIn() {
  return (
    <>
      <PageMeta
        title="Cơm365 Login Page"
        description="Đăng nhập hệ thống Cơm365 để quản lý và theo dõi thông tin suất ăn, thực đơn và các hoạt động liên quan."
      />
      <AuthLayout>
        <SignInForm />
      </AuthLayout>
    </>
  );
}
