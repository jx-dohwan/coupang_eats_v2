import { useState, type FormEvent } from "react";
import { LoginStyle as S } from "./Login.styled";
import coupangEatsLogo from "../../assets/images/coupang-eats-delivery-190910-04.png";
import { signIn } from "../../api/auth";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const canClick = email.trim().length > 0 && password.length > 0 && !loading;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canClick) return;

    setError(null);
    setSuccessMessage(null);
    setLoading(true);
    try {
      const data = await signIn({ email: email.trim(), password });
      setSuccessMessage(
        data.accessToken
          ? "로그인 성공 (accessToken 수신)"
          : "로그인 응답 형식 확인 필요",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "로그인에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <S.Wrapper>
      <S.Card>
        <S.Logo src={coupangEatsLogo} alt="Coupang Eats" />
        <S.Form onSubmit={onSubmit}>
          <S.Input
            type="email"
            placeholder="이메일"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
          <S.Input
            type="password"
            placeholder="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          {error && <S.ErrorText>{error}</S.ErrorText>}
          {!error && successMessage && <S.ErrorText>{successMessage}</S.ErrorText>}
          <S.Button type="submit" $canClick={canClick} $loading={loading} disabled={!canClick}>
            {loading ? "로그인 중..." : "로그인"}
          </S.Button>
        </S.Form>
        <S.SignupText>
          처음이신가요? <a href="/create-account">계정 만들기</a>
        </S.SignupText>
      </S.Card>
    </S.Wrapper>
  );
};
export default Login;
