現在「舊版草稿」和「舊版已提交回覆」不一樣。

已提交回覆：
不會再因為問卷更版把答案一起刪掉。這次修的是這個嚴重 bug。

舊版草稿：
目前還是看走哪條流程。

如果走 StartDraft / 重新開始填答：
StartDraft 會檢查現有 draft 的 survey_version_id 是否落後於目前已發布版本；如果落後，就呼叫 ResetToVersion()，把 draft 轉到新版，並清掉舊 draft answers。也就是說，舊版草稿內容會被重設，不能自動沿用。

如果直接拿既有 draft 繼續存或送出：
SaveDraftAnswer/SaveDraftAnswersBulk/SubmitDraft 目前是依 draft 自己綁定的 survey_version_id 做驗證，所以舊 draft 仍可依舊版 snapshot 繼續編輯或提交，只要問卷整體仍開放回覆。

所以結論是：

舊版已提交回覆：現在安全了。
舊版草稿：不會被 question rewrite 自動 cascade 刪掉。
但使用者一旦走「重新開始 / 重新取 draft」流程，backend 目前仍會把舊 draft 升到新版並清空答案。
如果你要，我下一步可以把「舊版草稿在更版後的產品行為」也一起收斂掉，明確選成其中一種：

保留舊版草稿並允許照舊版送出
一律升版並清空，但 UI 明講
嘗試做可對映題目的草稿搬移

