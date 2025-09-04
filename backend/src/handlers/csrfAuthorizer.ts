import { APIGatewayRequestAuthorizerHandler, APIGatewayAuthorizerResult } from 'aws-lambda';
import { validateCSRFToken } from '../utils/csrf';

export const handler: APIGatewayRequestAuthorizerHandler = async (event) => {
  try {
    // API Gatewayプロキシイベントの形式に変換
    const proxyEvent = {
      httpMethod: event.methodArn.split(':')[5].split('/')[2],
      headers: event.headers || {},
      // その他の必要なプロパティ
    } as any;
    
    // CSRF検証
    const isValid = validateCSRFToken(proxyEvent);
    
    // 検証結果に基づいてポリシーを生成
    const policy: APIGatewayAuthorizerResult = {
      principalId: 'user',
      policyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Action: 'execute-api:Invoke',
            Effect: isValid ? 'Allow' : 'Deny',
            Resource: event.methodArn,
          },
        ],
      },
    };
    
    // CSRF検証が失敗した場合、コンテキストにエラー情報を追加
    if (!isValid) {
      policy.context = {
        csrfError: 'Invalid or missing CSRF token',
      };
    }
    
    return policy;
  } catch (error) {
    console.error('CSRF Authorizer error:', error);
    
    // エラーが発生した場合は拒否
    return {
      principalId: 'user',
      policyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Action: 'execute-api:Invoke',
            Effect: 'Deny',
            Resource: event.methodArn,
          },
        ],
      },
    };
  }
};