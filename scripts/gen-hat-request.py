"""제품 요청서 v5 — 모자 + 데님 통합"""
import sys, os
sys.stdout.reconfigure(encoding='utf-8')

prod_dir = r'C:\Users\wwkfl\Desktop\heavyduty-content-site\reports\hat-request\images\products'
files = sorted([f for f in os.listdir(prod_dir) if f.endswith('.jpg')])
print(f'제품 {len(files)}장')

style_dir = r'C:\Users\wwkfl\Desktop\heavyduty-content-site\reports\hat-request\images\style'
style_files = sorted([f for f in os.listdir(style_dir) if f.lower().endswith(('.jpg','.png'))])
style_imgs = '\n    '.join([f'<img src="images/style/{f}">' for f in style_files])
print(f'스타일 {len(style_files)}장')

# 제품 28장 한 페이지 그리드 (스타일과 동일)
prod_items = []
for i, fname in enumerate(files):
    no = i + 1
    prod_items.append(f'''    <figure class="prod">
      <img src="images/products/{fname}">
      <figcaption>M-{no:02d}</figcaption>
    </figure>''')
prod_grid = '\n'.join(prod_items)

total_count = 5  # 표지 · 모자 스타일 · 모자 28장 · 데님 · 마지막

html = f'''<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>모자 제품 요청서 — 헤비듀티 아카이브</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css">
<style>
  @page {{ size: A4; margin: 0; }}
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{ font-family: 'Pretendard', sans-serif; color: #000; background: #FFF; -webkit-font-smoothing: antialiased; font-feature-settings: 'ss06','tnum'; }}
  .page {{ width: 210mm; height: 297mm; padding: 16mm 16mm 12mm 16mm; page-break-after: always; position: relative; background: #FFF; overflow: hidden; }}
  .page:last-child {{ page-break-after: auto; }}
  .label {{ font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace; font-size: 8.5pt; letter-spacing: 0.2em; text-transform: uppercase; color: #737373; font-weight: 500; margin-bottom: 4mm; }}
  .footer {{ position: absolute; bottom: 8mm; left: 16mm; right: 16mm; border-top: 1.5px solid #000; padding-top: 2mm; display: flex; justify-content: space-between; font-family: ui-monospace, monospace; font-size: 8pt; letter-spacing: 0.15em; text-transform: uppercase; color: #737373; }}
  h1 {{ font-size: 28pt; font-weight: 800; letter-spacing: -0.025em; line-height: 1.05; margin-bottom: 5mm; }}
  h2 {{ font-size: 16pt; font-weight: 700; letter-spacing: -0.01em; margin-bottom: 4mm; padding-bottom: 2.5mm; border-bottom: 2px solid #000; }}
  h3 {{ font-size: 11pt; font-weight: 700; margin-bottom: 2mm; }}
  p, li {{ font-size: 10pt; line-height: 1.55; }}
  b {{ font-weight: 700; }}

  .cover {{ display: flex; flex-direction: column; justify-content: center; }}
  .cover .super {{ font-size: 50pt; font-weight: 800; letter-spacing: -0.03em; line-height: 1.0; margin-bottom: 10mm; }}
  .cover .sub {{ font-size: 14pt; color: #404040; margin-bottom: 14mm; font-weight: 500; line-height: 1.55; }}

  .box {{ border: 2px solid #A3A3A3; padding: 4mm 5mm; margin-bottom: 3mm; }}
  .box.strong {{ border: 2px solid #000; }}
  .box.invert {{ background: #000; color: #FFF; border: 2px solid #000; }}
  .box.dashed {{ border: 2px dashed #A3A3A3; }}

  .style-grid {{ display: grid; grid-template-columns: repeat(5, 1fr); gap: 2.5mm; margin-top: 4mm; }}
  .style-grid img {{ width: 100%; aspect-ratio: 1 / 1; object-fit: cover; border: 1.5px solid #000; display: block; }}

  /* 제품 그리드 — 스타일과 동일 5열, 라벨만 추가 */
  .product-grid {{ display: grid; grid-template-columns: repeat(5, 1fr); gap: 2.5mm; margin-top: 4mm; }}
  .product-grid .prod {{ display: flex; flex-direction: column; }}
  .product-grid img {{ width: 100%; aspect-ratio: 1 / 1; object-fit: cover; border: 1.5px solid #000; display: block; }}
  .product-grid figcaption {{ font-family: ui-monospace, monospace; font-size: 8pt; letter-spacing: 0.15em; color: #525252; padding-top: 1.2mm; font-weight: 700; text-align: center; }}

  ul {{ list-style: none; }}
  ul.bullets li {{ padding: 1.5mm 0; padding-left: 5mm; position: relative; font-size: 10pt; }}
  ul.bullets li::before {{ content: ''; position: absolute; left: 0; top: 3.5mm; width: 2.5mm; height: 1.5px; background: #000; }}
</style>
</head>
<body>

<section class="page cover">
  <div class="label">Heavy Duty Archive · Product Request</div>
  <div style="height: 30mm;"></div>
  <div class="super">제품 요청서<br>모자 · 데님</div>
  <div class="sub">매칭 모자 라인업과 데님 라인업의<br>가격(PRICE)·최소 발주 수량(MOQ) 확인 요청.</div>

  <div class="box dashed" style="margin-top: 8mm;">
    <h3 style="margin-bottom: 2mm;">요청 개요</h3>
    <p><b>① 모자</b> · 헤비듀티 스타일과 매칭된다고 선정한 모자 사진을 첨부드립니다. 추가로 지향하는 스타일과 알맞은 레퍼런스 사진을 함께 첨부드립니다.</p>
    <p style="margin-top: 2mm;"><b>② 데님</b> · 리바이스 505·559·569 등 스트레이트 위주, 허리 사이즈 28~36 (메인 30~34) 라인업 요청.</p>
  </div>

  <div class="footer"><span>Heavy Duty Archive · Hat Request</span><span>1 / {total_count}</span></div>
</section>

<section class="page">
  <div class="label">Page 02 · Style Direction</div>
  <h1>우리가 지향하는 스타일</h1>

  <div class="box invert" style="margin-bottom: 4mm;">
    <h3 style="color: #FFF; margin-bottom: 2mm;">스타일 키워드</h3>
    <p style="color: #FFF;"><b>빈티지 헤리티지 캡</b> · 알파벳/로고 패치 · 레이싱·트럭커 빈티지 · 페이딩과 길든 룩</p>
  </div>

  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; margin-bottom: 4mm;">
    <ul class="bullets">
      <li><b>형태</b> · 아래 사진 참고</li>
      <li><b>그래픽</b> · 큰 알파벳 한 글자(P·F·K·A 등) 또는 빈티지 레이싱·기업 와펜 패치</li>
    </ul>
    <ul class="bullets">
      <li><b>마감</b> · 새것보다는 <b>길들어진 느낌</b>, 자연스러운 페이딩과 워싱</li>
      <li><b>브랜드 (제외)</b> · 스투시·슈프림 등 <b>스트릿 브랜드는 제외</b></li>
    </ul>
  </div>

  <h3>레퍼런스 21장</h3>
  <div class="style-grid">
    {style_imgs}
  </div>

  <div class="footer"><span>Heavy Duty Archive · Style Direction</span><span>2 / {total_count}</span></div>
</section>

<section class="page">
  <div class="label">Page 03 · Matched Products</div>
  <h1>매칭 제품 — 28장</h1>

  <p style="color: #404040; margin-bottom: 4mm;">대표님께서 선정해주신 모자 28종. 회신 시 <b>M-01 ~ M-28</b> 번호로 PRICE / MOQ 알려주시면 감사하겠습니다.</p>

  <div class="product-grid">
{prod_grid}
  </div>

  <div class="footer"><span>Heavy Duty Archive · Hats</span><span>3 / {total_count}</span></div>
</section>

<section class="page">
  <div class="label">Page 04 · Denim Request</div>
  <h1>데님 요청</h1>

  <div class="box invert" style="margin-bottom: 4mm;">
    <h3 style="color: #FFF; margin-bottom: 2mm;">요청 핵심</h3>
    <p style="color: #FFF;"><b>리바이스 스트레이트 핏 위주</b> · 허리 사이즈 28~36 (메인 30~34)</p>
  </div>

  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6mm; margin-top: 6mm;">
    <div class="box strong" style="padding: 6mm;">
      <h3 style="margin-bottom: 3mm; font-size: 13pt;">① 제품군</h3>
      <ul class="bullets" style="margin-top: 2mm;">
        <li><b>리바이스 505</b> — 레귤러 스트레이트</li>
        <li><b>리바이스 559</b> — 릴렉스 스트레이트</li>
        <li><b>리바이스 569</b> — 루즈 스트레이트</li>
        <li><b>기타 스트레이트 핏</b> 모델 가능 시 함께 추천 부탁드립니다.</li>
      </ul>
      <p style="margin-top: 4mm; font-size: 9.5pt; color: #525252;">스키니·테이퍼드·부츠컷 등 다른 실루엣은 이번 요청에서 제외.</p>
    </div>

    <div class="box strong" style="padding: 6mm;">
      <h3 style="margin-bottom: 3mm; font-size: 13pt;">② 사이즈</h3>
      <ul class="bullets" style="margin-top: 2mm;">
        <li>전체 범위 — <b>허리 28 ~ 36</b></li>
        <li>메인 사이즈 — <b>30 · 31 · 32 · 33 · 34</b> (가장 많이 확보)</li>
        <li>보조 사이즈 — <b>28 · 29 · 35 · 36</b> (재고 가능 시)</li>
      </ul>
      <p style="margin-top: 4mm; font-size: 9.5pt; color: #525252;">길이(인심)는 기본 가능 범위로, 별도 지정 없음.</p>
    </div>
  </div>

  <div class="box dashed" style="margin-top: 6mm; padding: 5mm 6mm;">
    <h3 style="margin-bottom: 2mm;">회신 요청 항목</h3>
    <ul class="bullets" style="margin-top: 2mm;">
      <li>모델별 <b>판매 가격(PRICE)</b></li>
      <li>모델·사이즈별 <b>재고 가능 여부 / 최소 발주 수량(MOQ)</b></li>
      <li>워싱 상태(원본·페이딩 정도) — 가능하시면 샘플 사진 1~2장 함께</li>
    </ul>
  </div>

  <div class="footer"><span>Heavy Duty Archive · Denim</span><span>4 / {total_count}</span></div>
</section>

<section class="page">
  <div class="label">Page 05 · Closing</div>
  <h1>회신 부탁드립니다</h1>

  <div class="box strong" style="margin-top: 6mm;">
    <h3 style="margin-bottom: 2mm;">전체 요청 정리</h3>
    <ul class="bullets" style="margin-top: 2mm;">
      <li><b>모자</b> — M-01 ~ M-28 각각의 PRICE / MOQ</li>
      <li><b>데님</b> — 리바이스 505·559·569 등 스트레이트, 허리 28~36의 PRICE / MOQ / 재고</li>
    </ul>
  </div>

  <div class="box invert" style="margin-top: 6mm;">
    <h3 style="color: #FFF; margin-bottom: 2mm;">감사합니다</h3>
    <p style="color: #FFF;">바쁘신 와중에 시간 내어 검토해주셔서 감사드립니다. 추가 문의나 협의가 필요하신 부분이 있으시면 언제든 연락 부탁드립니다.</p>
    <p style="color: #FFF; margin-top: 3mm;"><b>정윤빈 · 헤비듀티 아카이브</b></p>
  </div>

  <div class="footer"><span>Heavy Duty Archive · Closing</span><span>5 / {total_count}</span></div>
</section>

</body>
</html>
'''

html_path = r'C:\Users\wwkfl\Desktop\heavyduty-content-site\reports\hat-request\request.html'
with open(html_path, 'w', encoding='utf-8') as f:
    f.write(html)
print(f'HTML 작성 완료 — 총 {total_count}페이지 (제품 28장 한 페이지 그리드)')
