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

type StoredDraft = Omit<Draft, "file" | "preview">;

type CreatedIssue = {
  issue_id: string;
  issue_slug: string;
  issue_title: string;
};

type PublishedIssue = {
  issue_id: string;
  issue_title: string;
  issue_status: MonthlyIssue["status"];
};

type AdminTopicInput = {
  id: string;
  title: string;
  description: string;
};

const draftStorageKey = "mt-drafts-v1";

const defaultAdminTopics: AdminTopicInput[] = [
  {
    id: "default-topic-1",
    title: "Una escena de este mes",
    description: "Una foto simple de algo que quieras guardar de estos dias."
  },
  {
    id: "default-topic-2",
    title: "Algo que comimos",
    description: "Una comida, cafe, merienda o mesa compartida que haya valido la pena."
  },
  {
    id: "default-topic-3",
    title: "Un lugar donde estuve",
    description: "Una esquina, casa, camino o rincon que cuente algo del mes."
  },
  {
    id: "default-topic-4",
    title: "Algo que me hizo pensar en ustedes",
    description: "Una imagen que te haya conectado con la familia, aunque sea por un segundo."
  },
  {
    id: "default-topic-5",
    title: "Pequena alegria",
    description: "Una cosa minima que te alegro el dia."
  }
];

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
  const [section, setSection] = useState<"cover" | "index" | "topics" | "archive">("cover");
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [busySlot, setBusySlot] = useState<string | null>(null);
  const [adminBusy, setAdminBusy] = useState(false);
  const [publishBusy, setPublishBusy] = useState(false);
  const [adminTopics, setAdminTopics] = useState(defaultAdminTopics);
  const [profileOpen, setProfileOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<{ topic: Topic; group: FamilyGroup; contribution: Contribution | null } | null>(null);
  const [zoomedPhoto, setZoomedPhoto] = useState<{ src: string; title: string; caption?: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");

  const currentIssue = issues.find((issue) => issue.id === selectedIssueId) ?? issues[0] ?? null;
  const currentTopic = topics[topicIndex] ?? null;
  const canManageIssues = Boolean(selectedGroup?.can_manage_issues);
  const isEditingDraftIssue = currentIssue?.status === "draft";
  const canEditCurrentIssue = currentIssue?.status === "draft";
  const adminActionLabel = isEditingDraftIssue ? `Guardar topics de ${currentIssue.month}` : "Crear proximo mes";

  useEffect(() => {
    void loadJournal();
  }, []);

  useEffect(() => {
    setDrafts((current) => ({
      ...loadStoredDrafts(),
      ...current
    }));
  }, []);

  useEffect(() => {
    if (!canManageIssues || !isEditingDraftIssue || topics.length === 0) return;
    setAdminTopics(topicInputsFromTopics(topics));
  }, [canManageIssues, isEditingDraftIssue, currentIssue?.id, topics]);

  async function loadJournal(preferredIssueId = selectedIssueId) {
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
    const issue = loadedIssues.find((item) => item.id === preferredIssueId) ?? loadedIssues[0];
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

    const verifiedGroup = {
      ...(families.find((family) => family.slug === selectedGroup.slug) ?? selectedGroup),
      ...(data[0] as FamilyGroup)
    };
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

  function openEditor(topic: Topic, group: FamilyGroup, contribution: Contribution | null) {
    setEditingSlot({ topic, group, contribution });
  }

  function updateAdminTopic(id: string, patch: Partial<Omit<AdminTopicInput, "id">>) {
    setAdminTopics((current) => current.map((topic) => (topic.id === id ? { ...topic, ...patch } : topic)));
  }

  function addAdminTopic() {
    setAdminTopics((current) => [...current, createBlankAdminTopic()]);
  }

  function removeAdminTopic(id: string) {
    setAdminTopics((current) => (current.length <= 1 ? current : current.filter((topic) => topic.id !== id)));
  }

  function updateDraft(key: string, patch: Partial<Draft>, baseDraft = emptyDraft) {
    setDrafts((current) => {
      const next = {
        ...current,
        [key]: {
          ...(current[key] ?? baseDraft),
          ...patch
        }
      };
      saveStoredDrafts(next);
      return next;
    });
  }

  async function handleFileChange(key: string, event: ChangeEvent<HTMLInputElement>, baseDraft = emptyDraft) {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;

    const compressed = await compressImage(file);
    updateDraft(key, {
      file: compressed,
      preview: URL.createObjectURL(compressed)
    }, baseDraft);
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
    if (!canEditCurrentIssue) {
      setStatus("Este numero ya esta publicado y quedo en modo lectura.");
      return;
    }

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
      saveStoredDrafts(next);
      return next;
    });

    await loadJournal();
    setBusySlot(null);
    setEditingSlot(null);
    setStatus("Guardado. La pagina ya se actualizo para todos.");
  }

  async function createNextIssue() {
    if (!supabase || !selectedGroup || !savedPin) return;
    const customTopics = parseAdminTopics(adminTopics);

    if (customTopics.length === 0) {
      setStatus("Escribi al menos un tema para crear el proximo mes.");
      return;
    }

    setAdminBusy(true);
    setStatus(isEditingDraftIssue ? "Guardando topics..." : "Preparando proximo mes...");

    const { data, error } = await supabase.rpc("create_next_month_issue", {
      group_slug: selectedGroup.slug,
      pin: savedPin,
      custom_topics: customTopics
    });

    if (error) {
      setStatus(error.message);
      setAdminBusy(false);
      return;
    }

    const createdIssue = (data?.[0] ?? null) as CreatedIssue | null;
    if (createdIssue) {
      setSelectedIssueId(createdIssue.issue_id);
      await loadJournal(createdIssue.issue_id);
      setSection("index");
      setStatus(
        isEditingDraftIssue
          ? `Topics de ${createdIssue.issue_title} guardados.`
          : `${createdIssue.issue_title} ya esta preparado con los temas elegidos.`
      );
    }

    setAdminBusy(false);
  }

  async function publishCurrentIssue() {
    if (!supabase || !selectedGroup || !savedPin || !currentIssue || !isEditingDraftIssue) return;

    setPublishBusy(true);
    setStatus(`Publicando ${currentIssue.title}...`);

    const { data, error } = await supabase.rpc("publish_monthly_issue", {
      group_slug: selectedGroup.slug,
      pin: savedPin,
      target_issue_id: currentIssue.id
    });

    if (error) {
      setStatus(error.message);
      setPublishBusy(false);
      return;
    }

    const publishedIssue = (data?.[0] ?? null) as PublishedIssue | null;
    await loadJournal(publishedIssue?.issue_id ?? currentIssue.id);
    setSection("cover");
    setStatus(`${publishedIssue?.issue_title ?? currentIssue.title} publicado. El numero quedo en modo lectura.`);
    setPublishBusy(false);
  }

  const currentContributions = useMemo(() => {
    if (!currentTopic) return [];

    return shuffleBySeed(families, currentTopic.id).map((family) => ({
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
          <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          Inicio
        </button>
        <button className={section === "topics" ? "active" : ""} onClick={() => { setSection("topics"); setProfileOpen(false); }}>
          <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
          Temas
        </button>
        <button className={section === "archive" ? "active" : ""} onClick={() => { setSection("archive"); setProfileOpen(false); }}>
          <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20"/><path d="M8 7h8"/><path d="M8 11h8"/></svg>
          Biblioteca
        </button>
        <button className={profileOpen ? "active" : ""} onClick={() => setProfileOpen((open) => !open)}>
          <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
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
            <button className="ink-button" style={{ marginTop: "32px", fontSize: "1.1rem" }} onClick={() => setSection("index")}>
              Abrir cuaderno
            </button>
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
          <div className={`single-canvas-collage ${families.length > 0 ? "has-content" : ""}`}>
            {currentContributions.map(({ family, contribution }, index) => {
              const canEdit = canEditCurrentIssue && selectedGroup?.id === family.id;
              const key = `${currentTopic.id}-${family.id}`;
              const draft = draftFor(contribution ?? null, key);
              const imageSrc = draft.preview ?? contribution?.signed_url ?? "";
              
              return (
                <article
                  key={family.id}
                  className={`collage-slot slot-${index + 1} note-${draft.noteStyle} ${canEdit ? "own" : ""}`}
                  style={{ ["--accent" as string]: family.color ?? "#c7a35c" }}
                  onClick={canEdit ? () => openEditor(currentTopic, family, contribution ?? null) : undefined}
                >
                  {index % 3 === 0 && <div className="card-tape" />}
                  <div className="slot-photo-frame">
                    {imageSrc ? (
                      <button
                        type="button"
                        className="photo-zoom-button"
                        onClick={(e) => { e.stopPropagation(); setZoomedPhoto({ src: imageSrc, title: family.name, caption: contribution?.caption }); }}
                      >
                        <img src={imageSrc} alt={`Foto de ${family.name}`} />
                      </button>
                    ) : (
                      <div className="empty-photo">
                        <span className="empty-hint">Esperando la foto de {family.name}...</span>
                        {canEdit && <span className="edit-hint">✏️ Tocá para agregar tu foto</span>}
                      </div>
                    )}
                  </div>
                  <div className={`caption ${contribution?.is_bold ? "bold" : ""}`}>
                    {contribution?.title ? <h3>{contribution.title}</h3> : null}
                    {contribution?.caption ? <p>{contribution.caption}</p> : null}
                  </div>
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
            Acá elegís qué número leer. Los meses publicados y los borradores nuevos
            aparecen en esta mesa como revistas guardadas.
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
                <small>Numero {String(issue.issue_number).padStart(2, "0")} · {issueStatusLabel(issue.status)}</small>
              </button>
            ))}
            <div className="archive-issue next-issue">
              <span>{nextIssueLabel(currentIssue)}</span>
              <small>Próximo número</small>
            </div>
          </div>
          {canManageIssues ? (
            <div className="admin-panel">
              <p className="eyebrow">Admin</p>
              <h3>Preparar el proximo numero</h3>
              <p>
                {isEditingDraftIssue
                  ? `Estos son los topics de ${currentIssue.title}.`
                  : "Elegi los temas del mes. Podés dejar una bajada corta o completarla después."}
              </p>
              <div className="admin-topic-list">
                {adminTopics.map((topic, index) => (
                  <div className="admin-topic-option" key={topic.id}>
                    <span className="admin-topic-number">{String(index + 1).padStart(2, "0")}</span>
                    <div className="admin-topic-fields">
                      <input
                        aria-label={`Titulo del tema ${index + 1}`}
                        value={topic.title}
                        onChange={(event) => updateAdminTopic(topic.id, { title: event.target.value })}
                        placeholder="Titulo del topic"
                        maxLength={90}
                      />
                      <input
                        aria-label={`Bajada del tema ${index + 1}`}
                        value={topic.description}
                        onChange={(event) => updateAdminTopic(topic.id, { description: event.target.value })}
                        placeholder="Bajada opcional"
                        maxLength={220}
                      />
                    </div>
                    <button
                      type="button"
                      className="admin-topic-remove"
                      onClick={() => removeAdminTopic(topic.id)}
                      disabled={adminTopics.length <= 1}
                      aria-label={`Quitar tema ${index + 1}`}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <button className="paper-button admin-add-topic" type="button" onClick={addAdminTopic} disabled={adminTopics.length >= 8}>
                + Agregar topic
              </button>
              <button className="ink-button" onClick={createNextIssue} disabled={adminBusy}>
                {adminBusy ? "Guardando..." : adminActionLabel}
              </button>
              {isEditingDraftIssue ? (
                <button className="paper-button" onClick={publishCurrentIssue} disabled={publishBusy || adminBusy}>
                  {publishBusy ? "Publicando..." : `Publicar ${currentIssue.month}`}
                </button>
              ) : null}
            </div>
          ) : null}
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
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileChange(`${editingSlot.topic.id}-${editingSlot.group.id}`, e, draftFromContribution(editingSlot.contribution))} />
                </label>
              </div>
            ) : (
                <label className="photo-picker-large">
                  <div className="empty-photo">
                    <span>Tocá acá para subir tu foto</span>
                  </div>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileChange(`${editingSlot.topic.id}-${editingSlot.group.id}`, e, draftFromContribution(editingSlot.contribution))} />
                </label>
              )}
              <input
                value={draftFor(editingSlot.contribution, `${editingSlot.topic.id}-${editingSlot.group.id}`).title}
                maxLength={40}
                onChange={(event) => updateDraft(`${editingSlot.topic.id}-${editingSlot.group.id}`, { title: event.target.value }, draftFromContribution(editingSlot.contribution))}
                placeholder="Título corto (opcional)"
              />
              <textarea
                value={draftFor(editingSlot.contribution, `${editingSlot.topic.id}-${editingSlot.group.id}`).caption}
                maxLength={200}
                onChange={(event) => updateDraft(`${editingSlot.topic.id}-${editingSlot.group.id}`, { caption: event.target.value }, draftFromContribution(editingSlot.contribution))}
                placeholder="Escribe un breve recuerdo..."
              />
              <div className="format-row">
                <select
                  value={draftFor(editingSlot.contribution, `${editingSlot.topic.id}-${editingSlot.group.id}`).noteStyle}
                  onChange={(event) => updateDraft(`${editingSlot.topic.id}-${editingSlot.group.id}`, { noteStyle: event.target.value as Draft["noteStyle"] }, draftFromContribution(editingSlot.contribution))}
                >
                  {noteStyles.map((style) => (
                    <option key={style.value} value={style.value}>{style.label}</option>
                  ))}
                </select>
                <button
                  type="button"
                  className={draftFor(editingSlot.contribution, `${editingSlot.topic.id}-${editingSlot.group.id}`).isBold ? "bold-toggle active" : "bold-toggle"}
                  onClick={() => updateDraft(`${editingSlot.topic.id}-${editingSlot.group.id}`, { isBold: !draftFor(editingSlot.contribution, `${editingSlot.topic.id}-${editingSlot.group.id}`).isBold }, draftFromContribution(editingSlot.contribution))}
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

function nextIssueLabel(issue: MonthlyIssue | null) {
  if (!issue) return "Próximo número";

  const monthNumber = monthNameToNumber(issue.month);
  const nextMonthNumber = monthNumber === 12 ? 1 : monthNumber + 1;
  const nextYear = monthNumber === 12 ? issue.year + 1 : issue.year;

  return `${monthNumberToName(nextMonthNumber)} ${nextYear}`;
}

function monthNameToNumber(month: string) {
  switch (month.toLowerCase()) {
    case "enero":
      return 1;
    case "febrero":
      return 2;
    case "marzo":
      return 3;
    case "abril":
      return 4;
    case "mayo":
      return 5;
    case "junio":
      return 6;
    case "julio":
      return 7;
    case "agosto":
      return 8;
    case "septiembre":
    case "setiembre":
      return 9;
    case "octubre":
      return 10;
    case "noviembre":
      return 11;
    case "diciembre":
      return 12;
    default:
      return new Date().getMonth() + 1;
  }
}

function monthNumberToName(month: number) {
  const months = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre"
  ];

  return months[month - 1] ?? "Próximo número";
}

function issueStatusLabel(status: MonthlyIssue["status"]) {
  if (status === "draft") return "Borrador";
  if (status === "archived") return "Archivado";
  return "Publicado";
}

function parseAdminTopics(value: AdminTopicInput[]) {
  return value
    .slice(0, 8)
    .map((topic) => ({
      title: topic.title.trim().slice(0, 90),
      description: topic.description.trim().slice(0, 220) || null
    }))
    .filter((topic) => topic.title.length > 0);
}

function topicInputsFromTopics(items: Topic[]): AdminTopicInput[] {
  return items
    .slice()
    .sort((left, right) => left.order_index - right.order_index)
    .map((topic) => ({
      id: topic.id,
      title: topic.title,
      description: topic.description ?? ""
    }));
}

function createBlankAdminTopic(): AdminTopicInput {
  return {
    id: `admin-topic-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    title: "",
    description: ""
  };
}

function shuffleBySeed<T extends { id: string }>(items: T[], seed: string) {
  return [...items].sort((left, right) => seededScore(`${seed}-${left.id}`) - seededScore(`${seed}-${right.id}`));
}

function seededScore(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
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
    <div className="journal-decor" aria-hidden="true" style={{ opacity: 1, zIndex: 5 }}>
      {/* Hand-drawn star */}
      <svg className="scrap doodle-star" style={{ top: "8%", right: "12%", width: "40px", height: "40px", opacity: 0.8, transform: "rotate(15deg)" }} viewBox="0 0 100 100" fill="none" stroke="#222" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M50 10 L60 40 L90 40 L65 60 L75 90 L50 70 L25 90 L35 60 L10 40 L40 40 Z" />
      </svg>
      {/* Hand-drawn spiral */}
      <svg className="scrap doodle-spiral" style={{ bottom: "15%", left: "8%", width: "50px", height: "50px", opacity: 0.7, transform: "rotate(-20deg)" }} viewBox="0 0 100 100" fill="none" stroke="#111" strokeWidth="4" strokeLinecap="round">
        <path d="M50,50 m-5,0 a5,5 0 1,0 10,0 a10,10 0 1,0 -20,0 a15,15 0 1,0 30,0 a20,20 0 1,0 -40,0 a25,25 0 1,0 50,0 a30,30 0 1,0 -60,0 a35,35 0 1,0 70,0" />
      </svg>
      {/* Real pressed daisy */}
      <div className="scrapbook-flower" style={{ bottom: "5%", right: "10%", transform: "rotate(15deg)", pointerEvents: "none" }}>
        <div className="card-tape" style={{ top: "45%", left: "15%", width: "80px", height: "25px", transform: "rotate(-12deg)", zIndex: 10 }}></div>
      </div>
    </div>
  );
}

function draftFromContribution(contribution: Contribution | null): Draft {
  return {
    title: contribution?.title ?? "",
    caption: contribution?.caption ?? "",
    noteStyle: contribution?.note_style ?? "classic",
    isBold: contribution?.is_bold ?? false,
    file: null,
    preview: null
  };
}

function loadStoredDrafts(): Record<string, Draft> {
  if (typeof window === "undefined") return {};

  try {
    const rawDrafts = window.localStorage.getItem(draftStorageKey);
    if (!rawDrafts) return {};
    const parsed = JSON.parse(rawDrafts) as Record<string, StoredDraft>;

    return Object.fromEntries(
      Object.entries(parsed).map(([key, draft]) => [
        key,
        {
          title: draft.title ?? "",
          caption: draft.caption ?? "",
          noteStyle: draft.noteStyle ?? "classic",
          isBold: Boolean(draft.isBold),
          file: null,
          preview: null
        }
      ])
    );
  } catch {
    return {};
  }
}

function saveStoredDrafts(drafts: Record<string, Draft>) {
  if (typeof window === "undefined") return;

  const stored = Object.fromEntries(
    Object.entries(drafts)
      .filter(([, draft]) => draft.title.trim() || draft.caption.trim() || draft.noteStyle !== "classic" || draft.isBold)
      .map(([key, draft]) => [
        key,
        {
          title: draft.title,
          caption: draft.caption,
          noteStyle: draft.noteStyle,
          isBold: draft.isBold
        } satisfies StoredDraft
      ])
  );

  try {
    if (Object.keys(stored).length === 0) {
      window.localStorage.removeItem(draftStorageKey);
      return;
    }
    window.localStorage.setItem(draftStorageKey, JSON.stringify(stored));
  } catch {
    // If storage is unavailable, in-memory drafts still keep the editing flow usable.
  }
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
