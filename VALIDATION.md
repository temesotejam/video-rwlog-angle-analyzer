# Validation notes

このWeb版は、既存Python解析を基準実装として数値処理を移植しています。

## 2026-08-17 実測セット1

検証入力:

- `WIN_20260817_11_39_56_Pro.mp4`
- `dynamic_beta_holdcompare_zerocross_run_4_1307074020.rwlog`

### MP4 parser

Web版のISO-BMFF parserで以下を取得し、ffprobeで確認した値と一致することを確認しました。

- codec: `avc1.4D001F`
- resolution: `1280 x 720`
- frames: `1402`
- fps: `30.466824771571254`

### RWLOG parser

- format: v35
- samples: 1884
- CRC: OK
- synchronization anchors [s]:
  - 0.000
  - 2.515
  - 7.500
  - 12.510
  - 17.510
  - 22.517
  - 27.505
  - 30.000

### LED pattern matching

Python版で生成したwhole-frame brightness seriesをWeb版LED matcherへ入力し、START / MID x6 / ENDの検出フレーム時刻が一致することを確認しました。

動画側8 anchors [s]:

- 9.431049215406562
- 11.914599001426534
- 16.903632192106514
- 21.925487969567286
- 26.914521160247265
- 31.903554350927248
- 36.925410128388016
- 39.41992672372801

また、LED用brightness計算を1280x720から320x180へ縮小しても、この実測動画では8 anchorの検出フレーム時刻が変化しないことを確認しました。Web版では処理負荷を下げるため320px幅でbrightnessを計算します。

### 8-point time synchronization / comparison

Python版が出力した動画白丸角度をWeb版比較コアへ入力し、global affine 8-point mapping、piecewise diagnostic mapping、RMSE / MAE / biasを比較しました。

Global affine:

- scale: `0.9999293412897484`
- offset [s]: `9.41120797682177`
- anchor residual RMSE [ms]: `13.2473512213021`

代表RMSE [deg]:

- `pitch_dynamic_turnfast_deg`: `0.2672722768328`
- `pitch_dynamic_hold170_deg`: `0.3280629595834`
- `pitch_dynamic_hold120_deg`: `0.3434282346634`
- `pitch_dynamic_hold073_deg`: `0.3518781451548`

Web版の比較コアは上記Python結果と浮動小数点誤差レベルで一致しました。

## 2026-08-17 実測セット2

検証入力:

- `WIN_20260817_11_22_32_Pro.mp4`
- `dynamic_beta_holdcompare_zerocross_run_3_260232308.rwlog`

このセットでは、MID探索許容を `±0.75 s` とした場合、MID5が期待時刻より約 `0.616 s` 早い別の明るさ変化へ誤マッチしました。固定実験プロトコルではMIDは5秒間隔で発生するため、既定値を **`±0.40 s`** に狭めました。

この変更では実測セット1の検出結果は変化せず、セット2ではMID5が本来の点滅へ戻りました。

動画側8 anchors [s]:

- 6.232607843137255
- 8.728196078431372
- 13.725254901960785
- 18.722313725490196
- 23.719372549019607
- 28.716431372549017
- 33.71349019607843
- 36.245333333333335

RWLOG側8 anchors [s]:

- 0.000
- 2.507
- 7.505
- 12.509
- 17.520
- 22.504
- 27.514
- 30.000

修正後のglobal affine:

- scale: `0.9998032780643065`
- offset [s]: `6.220952279859686`
- anchor residual RMSE [ms]: `14.508665888494118`

白丸追跡:

- measurement window: `901 / 901` frames valid
- pre-measurement zero reference: `-0.80 .. -0.20 s`

代表RMSE [deg]:

- `pitch_dynamic_turnfast_deg`: `0.2246083727933`
- `pitch_dynamic_hold170_deg`: `0.2854974525135`
- `pitch_dynamic_hold120_deg`: `0.2933288610748`
- `pitch_dynamic_hold073_deg`: `0.2964830736294`

Web版JavaScriptコアへ同じbrightness・白丸角度・RWLOGを入力し、8 anchor、同期残差、RMSE / MAE / biasがPython版と浮動小数点誤差レベルで一致することを確認しました。

## Browser runtime status

MP4 container parsing、RWLOG parsing、CRC、LED matching、8-point synchronization、metrics calculationは複数の実測セットで個別に検証済みです。

GitHub Pagesは `main` / root から公開済みです。ただし、この開発環境ではブラウザUIへローカル実験ファイルを選択させる操作ができないため、WebCodecs `VideoDecoder` を含む**公開ページ上での完全なend-to-end実行**は、利用者側Chrome/Edgeで最終確認します。

最終確認項目:

1. H.264 MP4の全フレームデコード
2. START + MID x6 + END の8点同期
3. 白丸追跡率
4. 動画角度波形
5. `dynamic_turnfast`等のRMSE
6. ページ上の4グラフ表示
7. PNG / CSV / JSON / ZIPの保存

Web画面側では、未対応ブラウザの場合は解析開始を無効にします。
