import { Inject, Injectable, Scope } from '@nestjs/common';
import { INQUIRER } from '@nestjs/core';
import { WINSTON_MODULE_NEST_PROVIDER, WinstonLogger } from 'nest-winston';
import { v7 } from 'uuid';
import { Log } from './logger.interface';
import { MoinConfigService } from '../config/config.service';
import { Env } from '../config';

/**
 * [커스텀 로거 서비스]
 * Winston 로거를 래핑하고, 자동 컨텍스트 주입 및 로그 포맷팅을 담당한다.
 * 
 * @Injectable({ scope: Scope.TRANSIENT })
 * - TRANSIENT 스코프: 이 로거는 주입될 때마다(e.g., UserService, PostService...) 새로운 인스턴스로 생성된다.
 * - 이유: 'INQUIRER'를 통해 자신을 주입한 '소비자' 클래스가 무엇인지 알아내야 하므로, 인스턴스를 공유(Singleton)하면 안 된다.
 */
@Injectable({ scope: Scope.TRANSIENT })
export class LoggerService {
  private context: string; // 이 로거를 사용하는 클래스의 이름
  private isTest: boolean; // 테스트 환경 여부

  public constructor(
    // 1. nest-winston 모듈에서 실제 Winston 로거 인스턴스를 주입받음
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly winstonLogger: WinstonLogger,
    // 2. INQUIRER: Nest.js의 특수 프로바이더로 이 LoggerService를 주입한 부모 클래스(호출자)에 대한 정보를 담고 있음
    @Inject(INQUIRER) private readonly caller: object,
    // 3. MoinConfigService: 환경 변수(ENV) 등을 가져오기 위해 주입
    private readonly configService: MoinConfigService,
  ) {
    // 컨텍스트 자동 설정, 테스트 환경 설정
    ((this.context = this.caller?.constructor.name || 'Unknown'),
      (this.isTest = this.configService.getAppConfig().ENV === Env.test));
  }

  /**
   * 로그 객체를 표준 'Log' 인터페이스 형식으로 포맷팅한다.
   * @param obj obj 로깅할 대상(Error 객체, 문자열, 일반 객체 등)
   * @param message message 추가 메시지
   * @returns Log (logId, message, data? 등)
   */
  private format(obj: object | string, message = ''): Log {
    // 모든 로그에 고유한, 시간 순서 정렬이 가능한 ID 부여
    const log: Log = { message, logId: v7() };
    const appConfig = this.configService.getAppConfig();

    // additional metadata for cloudwatch
    // CloudWatch 등 원격 로깅을 위해 앱/환경 정보 추가(로컬 환경 제외)
    if (appConfig.ENV !== Env.local) {
      log.app = appConfig.NAME;
      log.env = appConfig.ENV;
    }

    // 1. Error 객체인 경우
    if (obj instanceof Error) {
      log.stack = obj.stack; // 스택 트레이스 포함
      return log;
    }

    // 2. 문자열인 경우
    if (typeof obj === 'string') {
      log.message = `${obj} ${message}`; // 두 문자열을 합침
      return log;
    }

    // 3. 일반 객체인 경우
    log.data = obj; // data 필드에 객체를 할당
    return log;
  }

  /**
   * 컨텍스트(클래스명)를 수동으로 덮어쓸 때 사용
   * @param context 
   */
  public setContext(context: string) {
    this.context = context;
  }

  /**
   * '클래스명.메스드명' 형태의 최종 컨텍스트 문자열을 생성
   * @param detailedContext  메서드명 또는 작업명
   * @returns 
   */
  private makeContextString(detailedContext: string) {
    return `${this.context}.${detailedContext}`;
  }

  // --- [로그 레벨별 메세드] ---
  public verbose(
    detailedContext: string,
    object: object | string, 
    message?: string,
  ) {
    const log = this.format(object, message);
    this.winstonLogger.verbose?.(log, this.makeContextString(detailedContext));
  }

  public debug(
    detailedContext: string,
    object: object | string,
    message?: string,
  ) {
    // [수정됨] this.format(Object, ...) -> this.format(object, ...)
    // 전역 Object 생성자가 아닌, 파라미터로 받은 object를 변수를 전달
    const log = this.format(object, message);
    this.winstonLogger.debug?.(log, this.makeContextString(detailedContext));
  }

  public info(
    detailedContext: string,
    object: object | string,
    message?: string,
  ) {
    const log = this.format(object, message);
      // Log 레벨은 winstonLogger.log() 메서드에 해당
    this.winstonLogger.log(log, this.makeContextString(detailedContext));
  }

  public warn(
    detailedContext: string,
    object: object | string,
    message?: string,
  ) {
    // 테스트 환경에서 'wran'로그를 기록하지 않음
    if (this.isTest) return;

    const log = this.format(object, message);
    this.winstonLogger.warn(log, this.makeContextString(detailedContext));
  }

  public error(
    detailedContext: string,
    object: object | string,
    message?: string,
  ) {
    // 테스트 환경에서는 'error' 로그를 기록하지 않음
    if (this.isTest) return;

    const log = this.format(object, message);
    this.winstonLogger.error(
      log,
      undefined, // 스택트레이스(winston이 log.stack을 참조하므로 undefined 전달)
      this.makeContextString(detailedContext),
    );
  }
}
