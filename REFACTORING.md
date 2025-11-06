# TypeScript リファクタリングについて

このプロジェクトはTypeScriptへの移行とファイル分割によるリファクタリングを実施しました。

## 変更内容

### TypeScript化されたファイル

#### メインプロセス
- `src/main/main.ts` - アプリケーションのエントリーポイント
- `src/main/window-manager.ts` - ウィンドウ管理
- `src/main/ipc-handlers.ts` - IPC通信ハンドラー
- `src/main/settings-manager.ts` - 設定管理
- `src/main/notification-manager.ts` - 通知管理
- `src/main/database.ts` - データベース操作
- `src/main/utils.ts` - ユーティリティ関数

#### プリロード
- `src/preload.ts` - プリロードスクリプト

#### レンダラープロセス
- `src/renderer/setting.ts` - 設定画面（TypeScript化）
- `src/renderer/renderer.js` - メインレンダラー（元のJavaScriptを維持）

#### 型定義
- `src/types/index.ts` - 共通の型定義

### 元のファイル

元のJavaScriptファイルは以下に保持されています：
- `src/main/main.js`
- `src/renderer/renderer.js`
- `src/renderer/setting.js`
- `src/preload.js`

## ビルド方法

### 1. 依存関係のインストール

```bash
npm install
```

### 2. TypeScriptのコンパイル

```bash
npm run build
```

これにより、TypeScriptファイルが `dist/` ディレクトリにコンパイルされます。

### 3. アプリケーションの起動

```bash
npm start
```

## 開発モード

TypeScriptを監視モードで実行：

```bash
npm run watch
```

## プロジェクト構成

```
my-electron-app/
├── src/
│   ├── main/           # メインプロセス（TypeScript）
│   │   ├── main.ts
│   │   ├── window-manager.ts
│   │   ├── ipc-handlers.ts
│   │   ├── settings-manager.ts
│   │   ├── notification-manager.ts
│   │   ├── database.ts
│   │   └── utils.ts
│   ├── renderer/       # レンダラープロセス
│   │   ├── renderer.js # JavaScript（元のまま）
│   │   └── setting.ts  # TypeScript
│   ├── types/          # 型定義
│   │   └── index.ts
│   ├── view/           # HTMLとCSS
│   └── preload.ts      # プリロード（TypeScript）
├── dist/               # ビルド出力（.gitignore）
├── config/             # 設定ファイル
├── prisma/             # Prismaスキーマ
├── tsconfig.json       # TypeScript設定
└── package.json

```

## 型安全性の向上

TypeScript化により、以下の型安全性が向上しました：

- スケジュール、設定、メモなどのデータ型が明確化
- IPC通信の型チェック
- コンパイル時のエラー検出

## 今後の改善案

- `renderer.js` のTypeScript化とモジュール分割
- テストの追加
- ESLintとPrettierの導入
- より詳細な型定義の追加
