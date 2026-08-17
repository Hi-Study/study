import BackButton from "@/components/BackButton";
import RegisterForm from "./register-form";

export const dynamic = "force-dynamic";

export default function RegisterPage() {
  return (
    <div className="screen">
      <div className="appbar"><BackButton /><span className="title" style={{ fontSize: 17 }}>글 등록</span></div>
      <RegisterForm />
    </div>
  );
}
