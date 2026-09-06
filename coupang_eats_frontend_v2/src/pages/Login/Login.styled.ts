import styled, { css } from "styled-components";

const inputBase = css`
  width: 100%;
  height: 44px;
  border: 1px solid #d1d5db; 
  border-radius: 8px;
  padding: 0 12px;
  font-size: 14px;
  outline: none;
  transition: border 0.15s ease, box-shadow 0.15s ease;
  background: #fff;

  &:focus {
    border-color: #0ea5e9;
    box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.15);
  }
`;

export const LoginStyle = {
  Wrapper: styled.div`
    width: 100%;
    min-height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-top: 2.5rem; 

  `,

  Card: styled.div`
    width: 100%;
    max-width: 40rem; 
    display: flex;
    flex-direction: column;
    align-items: center;
    padding-inline: 1.25rem;
  `,

  Logo: styled.img`
    width: 100%;
    max-width: 320px;
    margin-bottom: 2.5rem;
  `,

  Form: styled.form`
    display: grid;
    gap: 0.75rem;
    width: 100%;
    margin-block: 1.25rem 0.75rem; 
  `,

  Input: styled.input`
    ${inputBase}
  `,

  ErrorText: styled.p`
    color: #ef4444; 
    font-size: 13px;
    line-height: 1.2;
    margin-top: -2px;
  `,

  Button: styled.button<{ $loading?: boolean; $canClick?: boolean }>`
    height: 44px;
    border-radius: 8px;
    font-weight: 600;
    font-size: 15px;
    color: #fff;
    background: #0ea5e9; 
    border: none;
    cursor: pointer;
    transition: filter 0.15s ease, transform 0.02s ease;

    ${({ $loading }) =>
      $loading &&
      css`
        cursor: progress;
        filter: saturate(0.6) brightness(0.9);
      `}

    ${({ $canClick }) =>
      $canClick === false &&
      css`
        opacity: 0.5;
        cursor: not-allowed;
      `}

    &:active {
      transform: translateY(1px);
    }
  `,

  SignupText: styled.div`
    font-size: 14px;
    color: #374151; 

    a {
      color: #0ea5e9;
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
  `,
};
