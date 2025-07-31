# GitHub Actions OIDC CDKデプロイ設定

## セットアップ手順

### 1. GitHub組織名/ユーザー名の設定

`infrastructure/bin/filelair.ts`の以下の部分を編集してください：

```typescript
const githubOrg = app.node.tryGetContext('githubOrg') || process.env.GITHUB_ORG || 'your-github-username';
const githubRepo = app.node.tryGetContext('githubRepo') || process.env.GITHUB_REPO || 'file-sharing';
```

### 2. 初回のCDKデプロイ（OIDCプロバイダーとIAMロールの作成）

ローカルで以下のコマンドを実行：

```bash
cd infrastructure
npm install
cdk deploy
```

デプロイ完了後、出力に表示される`GitHubActionsRoleArn`の値をコピーしてください。

### 3. GitHub Secretsの設定

GitHubリポジトリの Settings > Secrets and variables > Actions で以下のシークレットを追加：

- **Name**: `AWS_ROLE_ARN`
- **Value**: 手順2でコピーしたIAMロールのARN

### 4. GitHub Actionsの動作確認

mainブランチにプッシュすると、GitHub Actionsが自動的にCDKをデプロイします。

## カスタマイズ

### CDKコンテキスト変数

以下の方法でGitHub組織名とリポジトリ名を指定できます：

```bash
cdk deploy -c githubOrg=myorg -c githubRepo=myrepo
```

### 環境変数

```bash
export GITHUB_ORG=myorg
export GITHUB_REPO=myrepo
cdk deploy
```

## トラブルシューティング

### OIDC認証エラー

エラーメッセージに「trust relationship」が含まれる場合は、IAMロールの信頼関係が正しく設定されているか確認してください。

### 権限エラー

CDKデプロイに必要な権限が不足している場合は、IAMロールに適切なポリシーがアタッチされているか確認してください。