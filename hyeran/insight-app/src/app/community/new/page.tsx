"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import BackButton from "@/components/BackButton";
import Icon from "@/components/Icon";

export default function NewCommunityPost() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [media, setMedia] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploading(true); setErr("");
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) { setErr("로그인이 필요해요"); setUploading(false); return; }
    for (const f of files) {
      const ext = f.name.split(".").pop() || "bin";
      const path = `${user.id}/${Date.now()}-${Math.round(Math.random() * 1e6)}.${ext}`;
      const up = await sb.storage.from("community").upload(path, f, { cacheControl: "3600", upsert: false });
      if (up.error) { setErr("업로드 실패: " + up.error.message); continue; }
      const { data } = sb.storage.from("community").getPublicUrl(path);
      setMedia((m) => [...m, data.publicUrl]);
    }
    setUploading(false);
    e.target.value = "";
  };

  const removeMedia = (url: string) => setMedia((m) => m.filter((x) => x !== url));

  const submit = async () => {
    if (!title.trim()) { setErr("제목을 입력해주세요"); return; }
    if (!body.trim()) { setErr("내용을 입력해주세요"); return; }
    if (busy) return;
    setBusy(true); setErr("");
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) { setErr("로그인이 필요해요"); setBusy(false); return; }
    const { data, error } = await sb.from("community_posts")
      .insert({ author_id: user.id, title: title.trim(), body: body.trim(), media })
      .select("id").single();
    if (error || !data) { setErr(error?.message || "저장에 실패했어요"); setBusy(false); return; }
    router.replace(`/community/${data.id}`);
  };

  const isVideo = (u: string) => /\.(mp4|webm|mov)$/i.test(u);

  return (
    <div style={{ paddingBottom: 40 }}>
      <div className="appbar">
        <BackButton />
        <span className="title">자유글 작성</span>
        <span className="spacer" />
        <button className="post-btn" disabled={busy} onClick={submit}>{busy ? "게시 중…" : "게시"}</button>
      </div>
      <div className="pad">
        <input className="cp-title-input" placeholder="제목" value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea className="cp-body-input" placeholder="자유롭게 이야기를 나눠보세요" rows={10} value={body} onChange={(e) => setBody(e.target.value)} />

        {media.length > 0 && (
          <div className="cp-media">
            {media.map((u) => (
              <div key={u} className="cp-media-item">
                {isVideo(u)
                  ? <video src={u} className="cp-media-el" />
                  : <span className="cp-media-el" style={{ backgroundImage: `url("${u}")` }} />}
                <button className="cp-media-x" onClick={() => removeMedia(u)}><Icon name="x" size="sm" /></button>
              </div>
            ))}
          </div>
        )}

        {err && <div className="cp-err">{err}</div>}

        <label className="cp-add">
          <Icon name="plus" size="sm" /> {uploading ? "업로드 중…" : "사진·영상 첨부"}
          <input type="file" accept="image/*,video/*" multiple hidden onChange={onPick} disabled={uploading} />
        </label>
      </div>
    </div>
  );
}
