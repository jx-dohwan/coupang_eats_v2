import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { LoginStyle as S } from "../Login/Login.styled";
import coupangEatsLogo from "../../assets/images/coupang-eats-delivery-190910-04.png";
import { verifyEmail } from "../../api/auth";

/**
 * 메일 링크 랜딩: /verify-email?token=...
 * API GET /auth/verify-email 을 호출하고 성공/실패 UI를 보여준다.
 * (만료·잘못된 토큰 → 400 은 API 정상 동작이며, 여기서 안내 문구로 표시)
 */
const VerifyEmail = () => {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [status, setStatus] = useState<"loading" | "ok" | "fail">("loading");
  const [message, setMessage] = useState("이메일 인증을 확인하는 중…");

  useEffect(() => {
    if (!token) {
      setStatus("fail");
      setMessage("인증 토큰이 없습니다. 메일 링크를 다시 확인해 주세요.");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const data = await verifyEmail(token);
        if (cancelled) return;
        setStatus("ok");
        setMessage(
          (data as { message?: string }).message ||
            (data as { data?: { message?: string } }).data?.message ||
            "이메일 인증이 완료되었습니다. 이제 로그인할 수 있습니다.",
        );
      } catch (err) {
        if (cancelled) return;
        setStatus("fail");
        setMessage(
          err instanceof Error
            ? err.message
            : "인증 링크가 만료되었거나 유효하지 않습니다.",
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <S.Wrapper>
      <S.Card>
        <S.Logo src={coupangEatsLogo} alt="Coupang Eats" />
        <h1 style={{ fontSize: "1.15rem", marginBottom: "0.75rem" }}>
          이메일 인증
        </h1>
        <p
          style={{
            textAlign: "center",
            color: status === "fail" ? "#b91c1c" : "#334155",
            lineHeight: 1.5,
            marginBottom: "1.25rem",
          }}
        >
          {message}
        </p>
        {status !== "loading" && (
          <Link
            to="/"
            style={{
              display: "inline-block",
              padding: "0.65rem 1.25rem",
              background: "#0ea5e9",
              color: "#fff",
              textDecoration: "none",
              borderRadius: 8,
              fontWeight: 600,
            }}
          >
            로그인으로 이동
          </Link>
        )}
      </S.Card>
    </S.Wrapper>
  );
};

export default VerifyEmail;
