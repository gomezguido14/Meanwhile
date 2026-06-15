"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { hasSupabaseConfig, supabase } from "../lib/supabase";

type FamilyGroup = {
  id: string;
  name: string;
  slug: string;
  avatar_url: string | null;
  avatar_signed_url?: string | null;
  color: string | null;
  icon: string | null;
  sort_order: number;
  can_manage_family: boolean;
  can_manage_issues: boolean;
};

type MonthlyIssue = {
  id: string;
  slug: string;
  title: string;
  month: string;
  year: number;
  issue_number: number;
  intro_text: string | null;
  closing_text: string | null;
  cover_image_url: string | null;
  cover_title: string | null;
  editor_group_id: string | null;
  status: "draft" | "published" | "archived";
};

type Topic = {
  id: string;
  monthly_issue_id: string;
  title: string;
  description: string | null;
  order_index: number;
  layout_type: string;
  hero_group_id: string | null;
};

type Contribution = {
  id: string;
  monthly_issue_id: string;
  topic_id: string;
  family_group_id: string;
  image_url: string | null;
  signed_url?: string | null;
  title: string | null;
  caption: string | null;
  note_style: "classic" | "handwritten" | "typewriter" | "cutout" | "modern";
  is_bold: boolean;
  updated_at: string;
};

type Draft = {
  title: string;
  caption: string;
  noteStyle: Contribution["note_style"];
  isBold: boolean;
  file: File | null;
  preview: string | null;
};

const noteStyles: Array<{ value: Contribution["note_style"]; label: string }> = [
  { value: "classic", label: "Editorial" },
  { value: "handwritten", label: "A mano" },
  { value: "typewriter", label: "Máquina" },
  { value: "cutout", label: "Recorte" },
  { value: "modern", label: "Moderna" }
];

const emptyDraft: Draft = {
  title: "",
  caption: "",
  noteStyle: "classic",
  isBold: false,
  file: null,
  preview: null
};

export default function Home() {
  const [families, setFamilies] = useState<FamilyGroup[]>([]);
  const [issues, setIssues] = useState<MonthlyIssue[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<FamilyGroup | null>(null);
  const [pin, setPin] = useState("");
  const [savedPin, setSavedPin] = useState("");
  const [loginError, setLoginError] = useState("");
  const [topicIndex, setTopicIndex] = useState(0);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [screen, setScreen] = useState<"cover" | "login" | "journal">("cover");
  const [section, setSection] = useState<"cover" | "index" | "topics" | "archive">("topics");
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [busySlot, setBusySlot] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<{ topic: Topic; group: FamilyGroup; contribution: Contribution | null } | null>(null);
  const [zoomedPhoto, setZoomedPhoto] = useState<{ src: string; title: string; caption?: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");

  const currentIssue = issues.find((issue) => issue.id === selectedIssueId) ?? issues[0] ?? null;
  const currentTopic = topics[topicIndex] ?? null;

  useEffect(() => {
    void loadJournal();
  }, []);

  async function loadJournal() {
    setLoading(true);
    setStatus("");

    if (!supabase || !hasSupabaseConfig) {
      setStatus("Faltan las variables de Supabase en Vercel.");
      setLoading(false);
      return;
    }

    const [familiesResult, issuesResult] = await Promise.all([
      supabase.from("family_groups_public").select("*").order("sort_order"),
      supabase.from("monthly_issues").select("*").order("year", { ascending: false }).order("issue_number", { ascending: false })
    ]);

    if (familiesResult.error || issuesResult.error) {
      setStatus(familiesResult.error?.message || issuesResult.error?.message || "No pude cargar la revista.");
      setLoading(false);
      return;
    }

    const loadedIssues = (issuesResult.data ?? []) as MonthlyIssue[];
    const loadedFamilies = await signFamilyAvatars((familiesResult.data ?? []) as FamilyGroup[]);
    const issue = loadedIssues.find((item) => item.id === selectedIssueId) ?? loadedIssues[0];
    setFamilies(loadedFamilies);
    setIssues(loadedIssues);
    setSelectedIssueId(issue?.id ?? null);

    if (!issue) {
      setLoading(false);
      setStatus("Todavia no hay ningun numero creado.");
      return;
    }

    await loadIssueContent(issue.id);
    setLoading(false);
  }

  async function loadIssueContent(issueId: string) {
    if (!supabase) return;

    const [topicsResult, contributionsResult] = await Promise.all([
      supabase.from("topics").select("*").eq("monthly_issue_id", issueId).order("order_index"),
      supabase.from("contributions").select("*").eq("monthly_issue_id", issueId)
    ]);

    if (topicsResult.error || contributionsResult.error) {
      setStatus(topicsResult.error?.message || contributionsResult.error?.message || "No pude cargar los temas.");
      return;
    }

    const loadedContributions = (contributionsResult.data ?? []) as Contribution[];
    const withSignedUrls = await signContributionImages(loadedContributions);

    setTopics((topicsResult.data ?? []) as Topic[]);
    setContributions(withSignedUrls);
    setTopicIndex(0);
  }

  async function signFamilyAvatars(items: FamilyGroup[]) {
    if (!supabase) return items;
    const client = supabase;

    return Promise.all(
      items.map(async (item) => {
        if (!item.avatar_url) return { ...item, avatar_signed_url: null };
        if (item.avatar_url.startsWith("http")) return { ...item, avatar_signed_url: item.avatar_url };
        const { data } = await client.storage.from("journal-photos").createSignedUrl(item.avatar_url, 60 * 60);
        return { ...item, avatar_signed_url: data?.signedUrl ?? null };
      })
    );
  }

  async function signContributionImages(items: Contribution[]) {
    if (!supabase) return items;
    const client = supabase;

    const signed = await Promise.all(
      items.map(async (item) => {
        if (!item.image_url) return { ...item, signed_url: null };
        const { data } = await client.storage.from("journal-photos").createSignedUrl(item.image_url, 60 * 60);
        return { ...item, signed_url: data?.signedUrl ?? null };
      })
    );

    return signed;
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedGroup || !supabase) return;

    setLoginError("");
    const { data, error } = await supabase.rpc("verify_family_pin", {
      group_slug: selectedGroup.slug,
      pin
    });

    if (error || !data || data.length === 0) {
      setLoginError("Ese PIN no coincide con este grupo.");
      return;
    }

    const verifiedGroup = data[0] as FamilyGroup;
    setSelectedGroup(verifiedGroup);
    setSavedPin(pin);
    localStorage.setItem("mt-family-slug", verifiedGroup.slug);
    setScreen("journal");
    setSection("topics");
    setProfileOpen(false);
  }

  function pickGroup(group: FamilyGroup) {
    setSelectedGroup(group);
    setPin("");
    setLoginError("");
    setScreen("login");
  }

  function contributionFor(topicId: string, groupId: string) {
    return contributions.find((item) => item.topic_id === topicId && item.family_group_id === groupId) ?? null;
  }

  function draftFor(contribution: Contribution | null, key: string) {
    return (
      drafts[key] ?? {
        title: contribution?.title ?? "",
        caption: contribution?.caption ?? "",
        noteStyle: contribution?.note_style ?? "classic",
        isBold: contribution?.is_bold ?? false,
        file: null,
        preview: null
      }
    );
  }

  function updateDraft(key: string, patch: Partial<Draft>) {
    setDrafts((current) => ({
      ...current,
      [key]: {
        ...(current[key] ?? emptyDraft),
        ...patch
      }
    }));
  }

  async function handleFileChange(key: string, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;

    const compressed = await compressImage(file);
    updateDraft(key, {
      file: compressed,
      preview: URL.createObjectURL(compressed)
    });
  }

  async function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (!file || !supabase || !selectedGroup || !savedPin) return;

    setStatus("");
    const compressed = await compressImage(file);
    const avatarPath = `avatars/${selectedGroup.id}.jpg`;

    const { error: uploadError } = await supabase.storage.from("journal-photos").upload(avatarPath, compressed, {
      upsert: true,
      contentType: "image/jpeg"
    });

    if (uploadError) {
      setStatus(uploadError.message);
      return;
    }

    const { error } = await supabase.rpc("save_family_avatar", {
      group_slug: selectedGroup.slug,
      pin: savedPin,
      new_avatar_url: avatarPath
    });

    if (error) {
      setStatus(error.message);
      return;
    }

    await loadJournal();
    setStatus("Foto de perfil actualizada.");
  }

  async function saveSlot(topic: Topic, group: FamilyGroup, contribution: Contribution | null) {
    if (!supabase || !selectedGroup || !savedPin || !currentIssue) return;
    const key = `${topic.id}-${group.id}`;
    const draft = draftFor(contribution, key);

    if (!draft.caption.trim() && !draft.title.trim() && !draft.file && !contribution?.image_url) {
      setStatus("Sumá una foto o un texto antes de guardar.");
      return;
    }

    setBusySlot(key);
    setStatus("");

    let imagePath = contribution?.image_url ?? null;

    if (draft.file) {
      imagePath = `${currentIssue.slug}/${topic.id}/${group.id}.jpg`;
      const { error: uploadError } = await supabase.storage.from("journal-photos").upload(imagePath, draft.file, {
        upsert: true,
        contentType: "image/jpeg"
      });

      if (uploadError) {
        setStatus(uploadError.message);
        setBusySlot(null);
        return;
      }
    }

    const { error } = await supabase.rpc("save_contribution", {
      group_slug: selectedGroup.slug,
      pin: savedPin,
      target_topic_id: topic.id,
      new_image_url: imagePath,
      new_title: draft.title.trim() || null,
      new_caption: draft.caption.trim() || null,
      new_note_style: draft.noteStyle,
      new_is_bold: draft.isBold
    });

    if (error) {
      setStatus(error.message);
      setBusySlot(null);
      return;
    }

    setDrafts((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });

    await loadJournal();
    setBusySlot(null);
    setEditingSlot(null);
    setStatus("Guardado. La pagina ya se actualizo para todos.");
  }

  const currentContributions = useMemo(() => {
    if (!currentTopic) return [];

    return families.map((family) => ({
      family,
      contribution: contributionFor(currentTopic.id, family.id)
    }));
  }, [families, contributions, currentTopic]);

  const selectedGroupWithAvatar = selectedGroup
    ? families.find((family) => family.id === selectedGroup.id) ?? selectedGroup
    : null;

  if (screen === "cover") {
    return (
      <main className="cover-page">
        <section className="cover-book">
          <div className="cover-copy">
            <p className="eyebrow">Revista familiar privada</p>
            <h1>
              Mientras
              <span>Tanto</span>
            </h1>
            <p className="cover-lede">
              Una revista mensual hecha con escenas chiquitas de la vida cotidiana.
            </p>
            <div className="paper-note">
              No es un album. Es nuestro libro familiar, completado de a poquito.
            </div>
            <div className="cover-actions">
              <button className="ink-button" onClick={() => setScreen("login")}>Entrar</button>
              <button className="paper-button" onClick={() => setScreen("login")}>Abrir número</button>
            </div>
          </div>
          <div className="cover-image">
            <img src="/mt-cover.png" alt="Costa al atardecer" />
            <span>Pequeñas cosas, grandes distancias</span>
          </div>
        </section>
      </main>
    );
  }

  if (screen === "login") {
    return (
      <main className="login-page">
        <section className="login-panel">
          <button className="back-button" onClick={() => setScreen("cover")}>Volver</button>
          <p className="eyebrow">Mientras Tanto</p>
          <h2>Quien esta entrando?</h2>
          {loading ? <p>Cargando familias...</p> : null}
          <div className="family-picker">
            {families.map((group) => (
              <button key={group.id} className="family-choice" onClick={() => pickGroup(group)}>
                <span style={{ background: group.color ?? "#d8c89f" }}>
                  {group.avatar_signed_url ? <img src={group.avatar_signed_url} alt={group.name} /> : initials(group.name)}
                </span>
                <strong>{group.name}</strong>
              </button>
            ))}
          </div>
          {selectedGroup ? (
            <form className="pin-form" onSubmit={handleLogin}>
              <label htmlFor="pin">PIN de {selectedGroup.name}</label>
              <input
                id="pin"
                value={pin}
                onChange={(event) => setPin(event.target.value)}
                autoFocus
                placeholder="PIN"
              />
              <button className="ink-button" type="submit">Abrir revista</button>
              {loginError ? <p className="error-text">{loginError}</p> : null}
            </form>
          ) : null}
          {status ? <p className="error-text">{status}</p> : null}
        </section>
      </main>
    );
  }

  return (
    <main className="journal-page">
      <header className="journal-header">
        <div>
          <p className="eyebrow">Num. {String(currentIssue?.issue_number ?? 1).padStart(2, "0")} - {currentIssue?.title ?? "Junio 2026"}</p>
          <h1>Mientras <span>Tanto</span></h1>
        </div>
      </header>

      {profileOpen && selectedGroup ? (
        <section className="profile-panel modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setProfileOpen(false); }}>
          <div className="bottom-sheet">
            <button className="close-button" onClick={() => setProfileOpen(false)}>✕</button>
            <div className="profile-header">
              <span className="profile-chip-large">
                {selectedGroupWithAvatar?.avatar_signed_url ? (
                  <img src={selectedGroupWithAvatar.avatar_signed_url} alt={selectedGroupWithAvatar.name} />
                ) : (
                  initials(selectedGroup.name)
                )}
              </span>
              <div>
                <strong>{selectedGroup.name}</strong>
                <p>Tu espacio familiar en la revista.</p>
              </div>
            </div>
            <label className="ink-button full-width text-center">
              Cambiar foto de perfil
              <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            </label>
            <button className="paper-button full-width" onClick={() => setScreen("login")}>Cambiar familia</button>
          </div>
        </section>
      ) : null}

      <nav className="bottom-nav">
        <button className={section === "cover" || section === "index" ? "active" : ""} onClick={() => { setSection("cover"); setProfileOpen(false); }}>
          <span className="nav-icon">🏠</span>
          Inicio
        </button>
        <button className={section === "topics" ? "active" : ""} onClick={() => { setSection("topics"); setProfileOpen(false); }}>
          <span className="nav-icon">📖</span>
          Temas
        </button>
        <button className={section === "archive" ? "active" : ""} onClick={() => { setSection("archive"); setProfileOpen(false); }}>
          <span className="nav-icon">📚</span>
          Biblioteca
        </button>
        <button className={profileOpen ? "active" : ""} onClick={() => setProfileOpen((open) => !open)}>
          <span className="nav-icon">👤</span>
          Perfil
        </button>
      </nav>

      {status ? <div className="status-bar">{status}</div> : null}

      {section === "cover" && currentIssue ? (
        <section className="issue-cover spread">
          <JournalDecor />
          <div>
            <p className="eyebrow">{currentIssue.month} {currentIssue.year}</p>
            <h2>{currentIssue.cover_title ?? currentIssue.title}</h2>
            <p>{currentIssue.intro_text}</p>
          </div>
          <img src={signedCover(currentIssue) ?? "/mt-cover.png"} alt="Portada del numero" />
        </section>
      ) : null}

      {section === "index" ? (
        <section className="index-spread spread">
          <JournalDecor />
          <div>
            <p className="eyebrow">Indice</p>
            <h2>{currentIssue?.title ?? "Junio 2026"}</h2>
          </div>
          <ol>
            {topics.map((topic, index) => (
              <li key={topic.id}>
                <button onClick={() => { setTopicIndex(index); setSection("topics"); }}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  {topic.title}
                </button>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {section === "topics" && currentTopic ? (
        <section className={`topic-spread spread layout-${currentTopic.layout_type}`}>
          <JournalDecor />
          <aside className="topic-intro">
            <p className="tape-label">Tema {String(currentTopic.order_index).padStart(2, "0")}</p>
            <CutoutTitle title={currentTopic.title} />
            <p>{currentTopic.description}</p>
            <div className="topic-controls">
              <button className="paper-button" onClick={() => setTopicIndex((topicIndex - 1 + topics.length) % topics.length)}>Anterior</button>
              <button className="paper-button" onClick={() => setTopicIndex((topicIndex + 1) % topics.length)}>Siguiente</button>
            </div>
          </aside>
          <div className="memory-collage">
            {currentContributions.map(({ family, contribution }, index) => {
              const canEdit = selectedGroup?.id === family.id;
              const key = `${currentTopic.id}-${family.id}`;
              const draft = draftFor(contribution, key);
              const imageSrc = draft.preview ?? contribution?.signed_url ?? "";
              return (
                <article
                  key={family.id}
                  className={`memory-card note-${draft.noteStyle} ${currentTopic.hero_group_id === family.id ? "hero" : ""} ${canEdit ? "own" : ""}`}
                  style={{ ["--accent" as string]: family.color ?? "#c7a35c" }}
                >
                  <div className="card-tape" />
                  <div className="photo-frame">
                    {imageSrc ? (
                      <button
                        type="button"
                        className="photo-zoom-button"
                        onClick={() => setZoomedPhoto({ src: imageSrc, title: family.name, caption: contribution?.caption })}
                      >
                        <img src={imageSrc} alt={`Foto de ${family.name}`} />
                      </button>
                    ) : (
                      <div className="empty-photo">
                        {canEdit ? <span>Toca "Editar" para subir tu foto</span> : <span>Este recuerdo espera una imagen</span>}
                      </div>
                    )}
                  </div>
                  <div className="slot-meta">
                    <strong>{family.name}</strong>
                    <span>{currentIssue?.month} {currentIssue?.year}</span>
                  </div>
                  <div className={`caption ${contribution?.is_bold ? "bold" : ""}`}>
                    {contribution?.title ? <h3>{contribution.title}</h3> : null}
                    {contribution?.caption ? <p>{contribution.caption}</p> : <p className="quiet">Todavía sin texto.</p>}
                  </div>
                  {canEdit && (
                    <button className="edit-overlay-btn" onClick={() => setEditingSlot({ topic: currentTopic, group: family, contribution })}>
                      ✏️ Editar mi página
                    </button>
                  )}
                  <span className="collage-index">{index + 1}</span>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {section === "archive" ? (
        <section className="archive-spread spread">
          <JournalDecor />
          <h2>Archivo</h2>
          <p className="archive-copy">
            Acá elegís qué número leer. Cuando creemos Julio, Agosto y los próximos meses,
            van a aparecer en esta mesa como revistas guardadas.
          </p>
          <div className="archive-list">
            {issues.map((issue) => (
              <button
                key={issue.id}
                className={`archive-issue ${currentIssue?.id === issue.id ? "active" : ""}`}
                onClick={async () => {
                  setSelectedIssueId(issue.id);
                  await loadIssueContent(issue.id);
                  setSection("cover");
                }}
              >
                <span>{issue.month} {issue.year}</span>
                <small>Numero {String(issue.issue_number).padStart(2, "0")}</small>
              </button>
            ))}
            <div className="archive-issue next-issue">
              <span>Julio 2026</span>
              <small>Próximo número</small>
            </div>
          </div>
          <p className="paper-note">
            El archivo no es una galería: es la biblioteca mensual de la familia.
          </p>
        </section>
      ) : null}

      {zoomedPhoto ? (
        <button className="photo-lightbox" onClick={() => setZoomedPhoto(null)}>
          <span className="lightbox-card">
            <img src={zoomedPhoto.src} alt={zoomedPhoto.title} />
            <span>
              <strong>{zoomedPhoto.title}</strong>
              {zoomedPhoto.caption ? <em>{zoomedPhoto.caption}</em> : null}
            </span>
          </span>
        </button>
      ) : null}

      {editingSlot ? (
        <section className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setEditingSlot(null); }}>
          <div className="bottom-sheet">
            <button className="close-button" onClick={() => setEditingSlot(null)}>✕</button>
            <h2>Editar mi página</h2>
            <p className="eyebrow">{editingSlot.topic.title}</p>
            <div className="editor-box">
              {draftFor(editingSlot.contribution, `${editingSlot.topic.id}-${editingSlot.group.id}`).preview || editingSlot.contribution?.signed_url ? (
                <div className="edit-photo-preview">
                  <img src={draftFor(editingSlot.contribution, `${editingSlot.topic.id}-${editingSlot.group.id}`).preview ?? editingSlot.contribution?.signed_url ?? ""} alt="Preview" />
                  <label className="paper-button">
                    Cambiar foto
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileChange(`${editingSlot.topic.id}-${editingSlot.group.id}`, e)} />
                  </label>
                </div>
              ) : (
                <label className="photo-picker-large">
                  <div className="empty-photo">
                    <span>Tocá acá para subir tu foto</span>
                  </div>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileChange(`${editingSlot.topic.id}-${editingSlot.group.id}`, e)} />
                </label>
              )}
              <input
                value={draftFor(editingSlot.contribution, `${editingSlot.topic.id}-${editingSlot.group.id}`).title}
                maxLength={40}
                onChange={(event) => updateDraft(`${editingSlot.topic.id}-${editingSlot.group.id}`, { title: event.target.value })}
                placeholder="Título corto (opcional)"
              />
              <textarea
                value={draftFor(editingSlot.contribution, `${editingSlot.topic.id}-${editingSlot.group.id}`).caption}
                maxLength={200}
                onChange={(event) => updateDraft(`${editingSlot.topic.id}-${editingSlot.group.id}`, { caption: event.target.value })}
                placeholder="Escribe un breve recuerdo..."
              />
              <div className="format-row">
                <select
                  value={draftFor(editingSlot.contribution, `${editingSlot.topic.id}-${editingSlot.group.id}`).noteStyle}
                  onChange={(event) => updateDraft(`${editingSlot.topic.id}-${editingSlot.group.id}`, { noteStyle: event.target.value as Draft["noteStyle"] })}
                >
                  {noteStyles.map((style) => (
                    <option key={style.value} value={style.value}>{style.label}</option>
                  ))}
                </select>
                <button
                  type="button"
                  className={draftFor(editingSlot.contribution, `${editingSlot.topic.id}-${editingSlot.group.id}`).isBold ? "bold-toggle active" : "bold-toggle"}
                  onClick={() => updateDraft(`${editingSlot.topic.id}-${editingSlot.group.id}`, { isBold: !draftFor(editingSlot.contribution, `${editingSlot.topic.id}-${editingSlot.group.id}`).isBold })}
                >
                  B
                </button>
              </div>
              <button 
                className="ink-button full-width" 
                disabled={busySlot === `${editingSlot.topic.id}-${editingSlot.group.id}`} 
                onClick={() => saveSlot(editingSlot.topic, editingSlot.group, editingSlot.contribution)}
              >
                {busySlot === `${editingSlot.topic.id}-${editingSlot.group.id}` ? "Guardando..." : "Guardar en la revista"}
              </button>
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter((part) => !["y", "de"].includes(part.toLowerCase()))
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function signedCover(issue: MonthlyIssue) {
  return issue.cover_image_url || null;
}

function CutoutTitle({ title }: { title: string }) {
  return (
    <h2 className="cutout-title">
      {title.split(" ").map((word, index) => (
        <span key={`${word}-${index}`}>{word}</span>
      ))}
    </h2>
  );
}

function JournalDecor() {
  return (
    <div className="journal-decor" aria-hidden="true">
      <span className="scrap scrap-news">recortes</span>
      <span className="scrap scrap-grid" />
      <span className="scrap scrap-flower">✽</span>
      <span className="scrap scrap-line" />
      <span className="scrap scrap-quote">pequenas historias</span>
    </div>
  );
}

async function compressImage(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const maxSize = 1600;
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d");
  context?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise<Blob>((resolve) => {
    canvas.toBlob((result) => resolve(result ?? file), "image/jpeg", 0.84);
  });

  return new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" });
}
