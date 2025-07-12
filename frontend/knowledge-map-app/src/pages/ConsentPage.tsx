// src/pages/ConsentPage.tsx
import React from 'react';
import { Button } from "@/components/ui/button"; // 必要に応じてインポート
import { useNavigate } from 'react-router-dom'; // 戻るボタン用
import { ScrollArea } from '@/components/ui/scroll-area'; // 長文の場合に備えて

const ConsentPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="container mx-auto max-w-3xl py-8 px-4">
      <ScrollArea className="h-[calc(100vh-10rem)] rounded-md border p-6 bg-card text-card-foreground"> {/* 高さとスクロール */}
        <h1 className="text-3xl font-bold mb-6 border-b pb-4">
          研究参加に関する同意書（説明書）
        </h1>
        
        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-3">1. 研究の目的と意義</h2>
          <p className="mb-2 text-sm leading-relaxed">
            本研究は、「知識マップを用いた学習の振り返り支援ツール」の利用が、学習者の振り返りの質や量、学習意欲にどのような影響を与えるかを調査することを目的としています。
            このツールの開発と評価を通じて、より効果的な学習支援方法の確立を目指します。あなたの参加は、今後の教育技術の発展に貢献する可能性があります。
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-3">2. 研究の方法</h2>
          <p className="mb-2 text-sm leading-relaxed">
            この研究では、開発した「知識マップを用いた学習の振り返り支援ツール」を実際に利用していただきます。
            具体的には、授業や自習の際にツールを使ってメモを取り、知識マップを生成・活用していただきます。
            実験期間中、ツールの利用ログ（操作履歴、生成されたマップデータなど）を収集させていただきます。
            また、実験の前後および期間中に、アンケートやインタビューにご協力いただく場合があります。
          </p>
          <p className="mb-2 text-sm leading-relaxed">
            収集する主なデータは以下の通りです。
          </p>
          <ul className="list-disc list-inside mb-2 text-sm space-y-1 pl-4">
            <li>ユーザー登録情報（Googleアカウントに基づくメールアドレス）</li>
            <li>メモの内容（テキスト、リッチテキスト情報）</li>
            <li>生成された知識マップのデータ（ノード、エッジ、構造）</li>
            <li>ツールの操作ログ（ボタンクリック、ページ遷移など）</li>
            <li>アンケート回答</li>
          </ul>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-3">3. 参加による利益と不利益</h2>
          <p className="mb-2 text-sm leading-relaxed">
            <strong className="font-medium">利益:</strong> 新しい学習ツールを体験し、ご自身の学習の振り返りに役立てることができます。また、本研究の成果は今後の学習支援技術の発展に貢献します。
          </p>
          <p className="mb-2 text-sm leading-relaxed">
            <strong className="font-medium">不利益:</strong> ツールの利用やアンケート・インタビューへの協力に時間を要する可能性があります。ツールが予期せぬ不具合を起こす可能性も完全に否定はできませんが、その際は速やかに対応いたします。
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-3">4. 個人情報の保護</h2>
          <p className="mb-2 text-sm leading-relaxed">
            収集されたデータは厳重に管理し、個人が特定できる情報（氏名、メールアドレスなど）は匿名化処理を施した上で分析に使用します。
            研究成果の発表（学会発表、論文投稿など）の際には、個人が特定できない形で公表します。
            収集したデータは、研究目的以外には一切使用いたしません。
            データの保管期間は研究終了後5年間とし、その後は適切に廃棄します。
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-3">5. 同意の任意性と撤回</h2>
          <p className="mb-2 text-sm leading-relaxed">
            この研究への参加は完全にあなたの自由意思によるものです。同意しない場合でも、あなたが不利益を被ることは一切ありません。
            また、一度同意した場合でも、いつでも理由を問わず同意を撤回し、研究への参加を中止することができます。
            同意を撤回した場合、それまでに収集されたあなたのデータは、可能な範囲で分析対象から除外または廃棄します。
            同意の撤回を希望される場合は、下記の問い合わせ先までご連絡ください。
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-3">6. 研究組織と問い合わせ先</h2>
          <p className="mb-2 text-sm leading-relaxed">
            研究代表者: 藤本 瑞士（電気通信大学 情報理工学域）<br />
            連絡先メールアドレス: [f2530118@gl.cc.uec.ac.jp]<br />
            ご不明な点や懸念事項がございましたら、ご遠慮なく上記の連絡先までお問い合わせください。
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-3">7. 同意の確認</h2>
          <p className="mb-2 text-sm leading-relaxed">
            上記の説明を理解し、本研究への参加に同意いただける場合は、ログインページのチェックボックスにチェックを入れてログイン操作を進めてください。
            チェックボックスへのチェックをもって、本説明書の内容に同意したものとみなします。
          </p>
        </section>

        <div className="mt-8 text-center">
          <Button onClick={() => navigate(-1)} variant="outline"> {/* -1 で前のページに戻る */}
            ログインページに戻る
          </Button>
        </div>
      </ScrollArea>
    </div>
  );
};

export default ConsentPage;
