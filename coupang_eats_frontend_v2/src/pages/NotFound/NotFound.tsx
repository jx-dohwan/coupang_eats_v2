import { useEffect } from "react";
import { Link } from "react-router-dom";
import { LoginStyle as S } from "../Login/Login.styled";
import coupangEatsLogo from "../../assets/images/coupang-eats-delivery-190910-04.png";

/** SPA 404 — 잘못된 경로 */
const NotFound = () => {
  useEffect(() => {
    document.title = "페이지를 찾을 수 없습니다 · Coupang Eats";
  }, []);

  return (
    <S.Wrapper>
      <S.Card>
        <S.Logo src={coupangEatsLogo} alt="Coupang Eats" />
        <p style={{ textAlign: "center", color: "#475569", lineHeight: 1.5 }}>
          요청하신 페이지를 찾을 수 없습니다.
        </p>
        <S.SignupText style={{ marginTop: "1rem" }}>
          <Link to="/">홈으로 돌아가기</Link>
        </S.SignupText>
      </S.Card>
    </S.Wrapper>
  );
};

export default NotFound;
