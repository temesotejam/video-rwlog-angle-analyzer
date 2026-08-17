# Validation notes

このWeb版は、既存Python解析を基準実装として数値処理を移植しています。

現在の主時刻同期は **START / END の2点線形同期**です。MID1〜MID6は主同期には使わず、START/END同期からの途中残差を確認する診断信号として扱います。8点piecewiseは詳細診断用です。

MID探索許容は固定実験プロトコルに合わせて `±0.40 s` を既定値としています。

## 実測セット1

- Video: `WIN_20260817_11_39_56_Pro.mp4`
- RWLOG: `dynamic_beta_holdcompare_zerocross_run_4_1307074020.rwlog`
- RWLOG: v35 / 1884 samples / CRC OK
- Video: 1280x720 / 1402 frames / 30.4668248 fps
- Measurement white-marker tracking: `914 / 914` valid

### START / END primary synchronization

- scale: `0.9996292502773817`
- video offset [s]: `9.431049215406562`
- MID residual [ms]: `[-30.518, -24.636, -10.923, -20.036, -36.147, -0.442]`
- MID residual RMSE: `23.6848455 ms`
- MID max abs residual: `36.1466930 ms`

MID correlations:

- `0.9553, 0.9170, 0.9407, 0.9450, 0.8929, 0.9437`

Representative primary RMSE [deg]:

- `pitch_dynamic_turnfast_deg`: `0.4652417`
- `pitch_dynamic_hold170_deg`: `0.4792505`
- `pitch_dynamic_hold120_deg`: `0.4934155`
- `pitch_dynamic_hold073_deg`: `0.5058712`

## 実測セット2

- Video: `WIN_20260817_11_22_32_Pro.mp4`
- RWLOG: `dynamic_beta_holdcompare_zerocross_run_3_260232308.rwlog`
- RWLOG: v35 / 1890 samples / CRC OK
- Measurement white-marker tracking: `901 / 901` valid

このセットではMID探索許容 `±0.75 s` だとMID5が別の明るさ変化へ誤マッチしました。`±0.40 s` に狭めることで本来のMIDへ戻ることを確認しています。

### START / END primary synchronization

- scale: `1.000424183006536`
- video offset [s]: `6.232607843137255`
- MID residual [ms]: `[-12.475, -15.536, -24.600, -40.667, -29.722, -44.789]`
- MID residual RMSE: `30.4012610 ms`
- MID max abs residual: `44.7886183 ms`

MID correlations:

- `0.8939, 0.9507, 0.9148, 0.8345, 0.6048, 0.8175`

Representative primary RMSE [deg]:

- `pitch_dynamic_hold170_deg`: `0.3877501`
- `pitch_dynamic_turnfast_deg`: `0.3958655`
- `pitch_dynamic_hold120_deg`: `0.4003071`
- `pitch_dynamic_hold073_deg`: `0.4154306`

## 実測セット3

- Video: `WIN_20260817_14_10_51_Pro.mp4`
- RWLOG: `dynamic_beta_holdcompare_zerocross_run_1_65086276.rwlog`
- Measurement white-marker tracking: `900 / 900` valid

### START / END primary synchronization

- scale: `0.9998284813197476`
- video offset [s]: `8.866098204754973`
- MID residual [ms]: `[-14.671, -4.551, -4.428, -0.306, -5.183, -4.061]`
- MID residual RMSE: `7.0594097 ms`
- MID max abs residual: `14.6714221 ms`

MID correlations:

- `0.9231, 0.9337, 0.8951, 0.8415, 0.9009, 0.7963`

Representative primary RMSE [deg]:

- `pitch_gyro_bias_corrected_deg`: `0.5726626`
- `pitch_dynamic_turnfast_deg`: `0.6188110`
- `pitch_dynamic_hold170_deg`: `0.7281482`
- `pitch_dynamic_hold120_deg`: `0.7788415`
- `pitch_dynamic_hold073_deg`: `0.7992402`

## Interpretation

3セットとも、MIDを主同期から外してもSTART/END間の途中残差は概ね数ms〜数十msの範囲です。MIDは動作中の映像変化を受けるため、この残差を診断として残しつつ、主RMSEの時間軸をMID検出へ依存させない設計にしています。

セット2のようにMID候補が不安定になるケースでも、MIDは主同期に使われないため、主比較の時間軸を直接壊しません。

## Browser runtime status

GitHub Pagesは `main` / root から公開しています。

MP4 container parsing、RWLOG parsing、CRC、LED matching、START/END synchronization、MID residual diagnostics、piecewise synchronization、metrics calculationは複数の実測セットで確認済みです。

この開発環境ではブラウザUIへローカル実験ファイルを選択させる操作ができないため、WebCodecs `VideoDecoder` を含む公開ページ上の完全なend-to-end実行は利用者側Chrome/Edgeで最終確認します。

最終確認項目:

1. H.264 MP4の全フレームデコード
2. START / END主同期
3. MID1〜MID6残差表示
4. 白丸追跡率
5. 動画角度波形
6. 主RMSEとPiecewise診断の表示
7. PNG / CSV / JSON / ZIPの保存
