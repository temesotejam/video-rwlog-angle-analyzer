# video-rwlog-angle-analyzer

ブラウザだけで、実験動画の白丸2点から求めた角度と `.rwlog` 内の姿勢推定値を比較する研究用ツールです。

## Web版の目的

- PCへPython / OpenCV / NumPyをインストールしなくてよい
- GitHub PagesのURLを開くだけで使える
- MP4とRWLOGはブラウザ内で処理し、解析のためにサーバーへアップロードしない
- 生成した比較グラフ、動画角度、LED同期グラフをページ上で確認できる
- CSV / JSON / PNGを個別保存できる
- 解析結果をまとめたZIPを保存できる

## 対応している実験形式

現在のWeb版は、今回の固定実験形式に意図的に特化しています。

- H.264 / AVC の MP4
- 画角は現在の 1280x720 実験配置を基準
- 白丸2点が下側の既知領域に写る
- START LED pattern → 実験開始 → MID blink x6 → END LED pattern
- RWLOG v34 / v35

動画デコードにはブラウザ標準の WebCodecs API を使います。最新の Chrome / Edge を推奨します。

## 解析仕様

### 動画角度

白丸2点を自動検出・追跡し、2点を結ぶ線の角度変化を算出します。

0°基準は測定開始前 **-0.80 s ～ -0.20 s** の中央値です。

### RWLOG角度

各 `pitch_*_deg` 系列について、`sync_event_id = 2` の明示的な実験 `t=0` の値を0°基準にします。

### 時刻同期

主結果の時間軸は **STARTとENDの2点だけ**で決めます。

```text
START ================================= END
        primary linear synchronization
```

動作中のMID1〜MID6は機体運動やモーションブラーの影響を受けるため、**主同期には使用しません**。START/ENDから予測される時刻との差を残差として計算し、途中でも同期が大きく崩れていないかを確認する診断信号として使います。

```text
START -------- MID1 MID2 MID3 MID4 MID5 MID6 -------- END
  |              diagnostic residual check only          |
  +---------------- primary START/END map ----------------+
```

8点をすべて通る piecewise linear 結果も詳細診断用として残しますが、主RMSEには使用しません。

MID探索許容の既定値は固定実験プロトコルに合わせて **±0.40 s** です。

## ページ上で確認できるもの

- START/END同期による Video vs RWLOG 比較グラフ
- **時系列ビュー**：動画角度・姿勢角・誤差・モータ電流・IMU・Beta・試験状態などから任意の系列を選び、共通時間軸・独立縦軸で縦に並べて表示
- 動画白丸角度グラフ
- LED同期グラフ
- MID1〜MID6の相関・START/END同期からの残差
- Piecewise診断グラフ
- RMSE / MAE / Bias
- MID残差RMSE
- 白丸追跡率
- RWLOG CRC

## 時系列ビュー

解析後の **「時系列ビュー」** では、1つの動画＋RWLOGセットから得られた数値系列を任意に選択できます。

- 横軸：全グラフで同じ `0 s ～ 測定終了`
- 縦軸：系列ごとに独立して自動スケーリング
- 2系列以上を縦に並べて比較可能（1系列だけでも表示可能）
- 系列名検索、主要系列の一括選択、個別PNG保存に対応
- `pitch_*_deg` は動画比較と同じ `t=0` 基準後の値を表示
- `pitch_*` の動画との差（error）、モータ指令・実電流、IMU、Beta、試験状態なども選択可能

RWLOG v34/v35の測定区間の数値系列は `rwlog/timeseries.csv` にも保存します。

## 解析結果ZIP

```text
led_sync/
  whole_frame_brightness.csv
  whole_frame_led_sync_summary.json
  whole_frame_led_sync_timeseries.png
  mid_sync_diagnostics.csv
angle/
  video_white_line_tracking.csv
  video_white_angle_summary.json
  video_white_angle_timeseries.png
rwlog/
  header.json
  metadata.json
  timeseries.csv
comparison/
  video_rwlog_aligned.csv
  video_rwlog_aligned_piecewise.csv
  video_rwlog_rmse_summary.json
  video_rwlog_angle_comparison.png
  video_rwlog_angle_comparison_piecewise.png
web_analysis_summary.json
```

`comparison/video_rwlog_aligned.csv` とページ上の主RMSEはSTART/END同期です。`video_rwlog_aligned_piecewise.csv` は診断用です。

## 公開ページ

GitHub Pagesは `main` / `/(root)` から公開します。

```text
https://temesotejam.github.io/video-rwlog-angle-analyzer/
```

## ローカルで確認する場合

ES modulesを使っているため、`index.html` を `file://` で直接開かずローカルHTTPサーバーで開きます。

```bash
python -m http.server 8000
```

その後 `http://localhost:8000/` をChrome/Edgeで開きます。

## 数値検証

Web移植では、今回使用しているPython解析ツールを基準として次の数値処理を照合しています。

- LED pattern matching
- RWLOG v34/v35 binary parsing
- RWLOG CRC32
- START/END affine synchronization
- MID residual diagnostics
- piecewise diagnostic synchronization
- t=0 zero reference
- RMSE / MAE / Bias

複数の実測セットでの検証値は [`VALIDATION.md`](./VALIDATION.md) に記録しています。

## 構成

```text
index.html        Web UI
styles.css        UI style
src/
  app.js          UI / orchestration
  mp4.js          MP4 parser + WebCodecs decoder
  rwlog.js        RWLOG v34/v35 parser + CRC
  analysis.js     LED / marker / synchronization / metrics
  timeseries.js   selectable time-series catalog
  plot.js         Canvas graph rendering
  export.js       CSV / JSON / download helpers
  zip.js          dependency-free ZIP writer
VALIDATION.md      実測データとの数値一致確認
```

外部CDNやJavaScriptライブラリには依存していません。
