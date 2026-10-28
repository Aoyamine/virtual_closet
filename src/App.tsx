import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import {
  ArrowDownToLine,
  ArrowRight,
  Check,
  CircleHelp,
  Glasses,
  Grid2X2,
  ImagePlus,
  Leaf,
  LoaderCircle,
  Minus,
  Plus,
  RotateCcw,
  ScanFace,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { Mirror } from './components/Mirror';
import { catalog } from './lib/catalog';
import { prepareAccessory } from './lib/images';
import { loadLooks, loadUploads, saveLooks, saveUploads } from './lib/storage';
import type { Accessory, SavedLook } from './lib/storage';
import type { Placement } from './lib/render';

type View = 'mirror' | 'collection' | 'looks';
const defaults: Placement = { scale: 1, offsetY: 0, rotation: 0, opacity: 1 };

export default function App() {
  const [view, setView] = useState<View>('mirror');
  const [uploads, setUploads] = useState(loadUploads);
  const [looks, setLooks] = useState(loadLooks);
  const [selected, setSelected] = useState<Accessory>(catalog[0]);
  const [placement, setPlacement] = useState<Placement>(defaults);
  const [filter, setFilter] = useState<'all' | 'catalog' | 'upload'>('all');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [notice, setNotice] = useState<{ message: string; error?: boolean } | null>(null);
  const allItems = [...catalog, ...uploads];
  const items = allItems.filter((item) => filter === 'all' || item.source === filter);

  useEffect(() => {
    if (!notice || notice.error) return;
    const timeout = window.setTimeout(() => setNotice(null), 4500);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  function choose(item: Accessory) {
    setSelected(item);
    setPlacement(defaults);
  }

  function reportError(message: string) {
    setNotice({ message, error: true });
  }

  function addUpload(item: Accessory) {
    const next = [...uploads, item];
    saveUploads(next);
    setUploads(next);
    choose(item);
    setFilter('all');
    setView('mirror');
    setNotice({ message: `${item.name} is ready to try on.` });
  }

  function removeUpload(item: Accessory) {
    try {
      const next = uploads.filter((upload) => upload.id !== item.id);
      saveUploads(next);
      setUploads(next);
      if (selected.id === item.id) choose(catalog[0]);
      setNotice({ message: 'Piece removed from your collection.' });
    } catch (error) {
      reportError(errorMessage(error));
    }
  }

  function capture(image: string) {
    try {
      const look: SavedLook = {
        id: crypto.randomUUID(),
        name: selected.name,
        image,
        createdAt: new Date().toISOString(),
      };
      const next = [look, ...looks];
      saveLooks(next);
      setLooks(next);
      setNotice({ message: 'Look saved. You’ll find it in Saved looks.' });
    } catch (error) {
      reportError(errorMessage(error));
    }
  }

  function removeLook(id: string) {
    try {
      const next = looks.filter((look) => look.id !== id);
      saveLooks(next);
      setLooks(next);
    } catch (error) {
      reportError(errorMessage(error));
    }
  }

  const navigation = [
    { id: 'mirror' as const, label: 'Fitting room', icon: ScanFace },
    { id: 'collection' as const, label: 'My collection', icon: Grid2X2 },
    { id: 'looks' as const, label: 'Saved looks', icon: ImagePlus },
  ];

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Main navigation">
        <button className="brand-mark" aria-label="Forme home" onClick={() => setView('mirror')}>
          f<span>·</span>
        </button>
        <nav>
          {navigation.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`nav-button ${view === id ? 'active' : ''}`}
              aria-label={label}
              aria-current={view === id ? 'page' : undefined}
              onClick={() => setView(id)}
            >
              <Icon size={22} strokeWidth={1.6} />
              <span>{label}</span>
              {id === 'looks' && looks.length > 0 && <i className="nav-count">{looks.length}</i>}
            </button>
          ))}
        </nav>
        <button className="help-button" aria-label="How it works" onClick={() => setHelpOpen(true)}>
          <CircleHelp size={21} />
          <span>How it works</span>
        </button>
        <div className="sidebar-footer">
          A little
          <br />
          <em>more you.</em>
          <div className="tiny-flower">✳</div>
        </div>
      </aside>

      <div className="main-shell">
        <header className="app-header">
          <a
            className="wordmark"
            href="#"
            onClick={(event) => {
              event.preventDefault();
              setView('mirror');
            }}
          >
            forme<span> / </span>
            <small>THE VIRTUAL FITTING ROOM</small>
          </a>
          <div className="header-right">
            <button
              className="mobile-help"
              aria-label="How it works"
              onClick={() => setHelpOpen(true)}
            >
              <CircleHelp size={19} strokeWidth={1.5} />
            </button>
            <span className="private-pill">
              <span />
              Private by design
            </span>
            <button
              className="avatar"
              aria-label="About your local collection"
              onClick={() => setHelpOpen(true)}
            >
              You
            </button>
          </div>
        </header>

        <main className="main-content">
          <section className="page-heading">
            <div>
              <div className="eyebrow">
                <span /> A NEW WAY TO FIND YOUR STYLE
              </div>
              <h1>
                {view === 'mirror' ? (
                  <>
                    A little change. <em>A whole new you.</em>
                  </>
                ) : view === 'collection' ? (
                  <>
                    Good taste, <em>all in one place.</em>
                  </>
                ) : (
                  <>
                    Looks worth <em>keeping.</em>
                  </>
                )}
              </h1>
              <p>
                {view === 'mirror'
                  ? 'Meet your next favorite pair. Try it on, make it yours.'
                  : view === 'collection'
                    ? 'Your curated favorites and one-of-a-kind finds. Ready for a closer look?'
                    : 'A collection of your favorite moments. Saved only in this browser.'}
              </p>
            </div>
            <button className="outline-button heading-upload" onClick={() => setUploadOpen(true)}>
              <Plus size={17} /> Upload a piece
            </button>
          </section>

          {view === 'mirror' ? (
            <div className="fitting-layout">
              <section className="mirror-column" aria-label="Virtual fitting room">
                <div className="section-line">
                  <span>
                    <span className="step-number">01</span> YOUR MIRROR
                  </span>
                  <span className="section-note">
                    <ShieldCheck size={13} /> Just you. Just here.
                  </span>
                </div>
                <Mirror
                  selected={selected}
                  placement={placement}
                  onCapture={capture}
                  onError={reportError}
                />
                <div className="mirror-footnote">
                  <span>
                    <ScanFace size={15} /> Move naturally. Your frames will follow.
                  </span>
                  <span>2D preview · Not a sizing tool</span>
                </div>
                <div className="privacy-note">
                  <div className="privacy-icon">
                    <Leaf size={20} strokeWidth={1.4} />
                  </div>
                  <div>
                    <strong>Your camera stays yours.</strong>
                    <p>Live tracking happens on your device. Nothing is sent to a server.</p>
                  </div>
                  <ShieldCheck size={21} strokeWidth={1.3} />
                </div>
              </section>

              <aside className="collection-panel" aria-label="Choose and adjust eyewear">
                <div className="section-line">
                  <span>
                    <span className="step-number">02</span> FIND YOUR PAIR
                  </span>
                  <span className="piece-count">{allItems.length} pieces</span>
                </div>
                <div className="collection-tabs" role="group" aria-label="Filter collection">
                  {(['all', 'catalog', 'upload'] as const).map((value) => (
                    <button
                      key={value}
                      aria-pressed={filter === value}
                      className={filter === value ? 'active' : ''}
                      onClick={() => setFilter(value)}
                    >
                      {value === 'all'
                        ? 'All pieces'
                        : value === 'catalog'
                          ? 'The edit'
                          : 'Your uploads'}
                      {value === 'upload' && uploads.length > 0 && <span>{uploads.length}</span>}
                    </button>
                  ))}
                </div>
                <div className="accessory-grid">
                  {items.map((item) => (
                    <AccessoryCard
                      key={item.id}
                      item={item}
                      selected={selected.id === item.id}
                      onSelect={() => choose(item)}
                    />
                  ))}
                  {items.length === 0 && (
                    <div className="empty-upload">
                      <Glasses size={31} strokeWidth={1.2} />
                      <strong>Your next favorite belongs here.</strong>
                      <p>Upload a front-facing photo of a pair you love.</p>
                      <button className="text-button" onClick={() => setUploadOpen(true)}>
                        Add your first pair <ArrowRight size={14} />
                      </button>
                    </div>
                  )}
                </div>
                <button className="upload-card" onClick={() => setUploadOpen(true)}>
                  <span className="upload-icon">
                    <Plus size={20} strokeWidth={1.5} />
                  </span>
                  <span>
                    <strong>Found something you love?</strong>
                    <small>Bring your own pair to the fitting room.</small>
                  </span>
                  <ArrowRight size={16} />
                </button>

                <section className="adjustment-panel" aria-label="Placement controls">
                  <div className="adjustment-header">
                    <h2>
                      <SlidersHorizontal size={15} /> The perfect placement
                    </h2>
                    <button
                      aria-label="Reset adjustments"
                      title="Reset adjustments"
                      onClick={() => setPlacement(defaults)}
                    >
                      <RotateCcw size={15} />
                    </button>
                  </div>
                  <div className="selected-piece">
                    <span className="selection-dot" />
                    {selected.name}
                    <span>{selected.shape}</span>
                  </div>
                  <Range
                    label="Size"
                    value={Math.round(placement.scale * 100)}
                    min={55}
                    max={160}
                    unit="%"
                    onChange={(value) =>
                      setPlacement((current) => ({ ...current, scale: value / 100 }))
                    }
                  />
                  <Range
                    label="Height"
                    value={Math.round(placement.offsetY * 100)}
                    min={-40}
                    max={40}
                    unit=""
                    onChange={(value) =>
                      setPlacement((current) => ({ ...current, offsetY: value / 100 }))
                    }
                  />
                  <Range
                    label="Tilt"
                    value={placement.rotation}
                    min={-25}
                    max={25}
                    unit="°"
                    onChange={(value) =>
                      setPlacement((current) => ({ ...current, rotation: value }))
                    }
                  />
                  <p className="placement-hint">A small adjustment can make all the difference.</p>
                </section>
              </aside>
            </div>
          ) : view === 'collection' ? (
            <section className="library-view">
              <div className="library-toolbar">
                <h2>
                  Your collection <span>{allItems.length} pieces</span>
                </h2>
                <span>
                  Choose a pair to try it on <ArrowRight size={16} />
                </span>
              </div>
              <div className="library-grid">
                {allItems.map((item) => (
                  <div key={item.id} className="library-item">
                    <AccessoryCard
                      item={item}
                      selected={selected.id === item.id}
                      onSelect={() => {
                        choose(item);
                        setView('mirror');
                      }}
                    />
                    {item.source === 'upload' && (
                      <button
                        className="remove-piece"
                        aria-label={`Remove ${item.name}`}
                        onClick={() => removeUpload(item)}
                      >
                        <Trash2 size={14} /> Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ) : (
            <section className="saved-view">
              {looks.length ? (
                <>
                  <div className="library-toolbar">
                    <h2>
                      Your saved looks{' '}
                      <span>
                        {looks.length} {looks.length === 1 ? 'look' : 'looks'}
                      </span>
                    </h2>
                    <button className="text-button" onClick={() => setView('mirror')}>
                      Back to the mirror <ArrowRight size={15} />
                    </button>
                  </div>
                  <div className="looks-grid">
                    {looks.map((look) => (
                      <article className="look-card" key={look.id}>
                        <img src={look.image} alt={`Saved try-on wearing ${look.name}`} />
                        <div>
                          <h3>{look.name}</h3>
                          <span>
                            {new Date(look.createdAt).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                        </div>
                        <footer>
                          <a
                            href={look.image}
                            download={`forme-${look.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.jpg`}
                          >
                            <ArrowDownToLine size={15} /> Download
                          </a>
                          <button
                            aria-label={`Delete saved look ${look.name}`}
                            onClick={() => removeLook(look.id)}
                          >
                            <Trash2 size={15} />
                          </button>
                        </footer>
                      </article>
                    ))}
                  </div>
                </>
              ) : (
                <div className="empty-looks">
                  <div className="empty-looks-icon">
                    <ImagePlus size={38} strokeWidth={1.1} />
                  </div>
                  <div className="eyebrow">MAKE A LITTLE MEMORY</div>
                  <h2>
                    Your good side. <em>Saved.</em>
                  </h2>
                  <p>
                    Find a pair you love, then tap the snapshot button
                    <br />
                    in the mirror to keep the moment.
                  </p>
                  <button className="primary-button" onClick={() => setView('mirror')}>
                    Find your look <ArrowRight size={16} />
                  </button>
                </div>
              )}
            </section>
          )}

          <footer className="page-footer">
            <span>Made for the many versions of you.</span>
            <span>
              FORME <span className="footer-star">✳</span> EXPERIMENTAL EDITION 001
            </span>
          </footer>
        </main>
      </div>

      {notice && (
        <div
          className={`toast ${notice.error ? 'error' : ''}`}
          role={notice.error ? 'alert' : 'status'}
        >
          {!notice.error && <Check size={18} />}
          <span>{notice.message}</span>
          <button aria-label="Dismiss notification" onClick={() => setNotice(null)}>
            <X size={17} />
          </button>
        </div>
      )}
      {uploadOpen && <UploadDialog onClose={() => setUploadOpen(false)} onAdd={addUpload} />}
      {helpOpen && (
        <Dialog title="Your own little fitting room." onClose={() => setHelpOpen(false)}>
          <div className="help-intro">A fresh perspective, without leaving your browser.</div>
          <ol className="help-steps">
            <li>
              <span>01</span>
              <div>
                <strong>Find your pair</strong>
                <p>
                  Explore the edit, or upload a clear, front-facing PNG, JPEG, or WebP of your
                  glasses.
                </p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <strong>Make it personal</strong>
                <p>
                  Start your camera to see frames follow your face. Adjust the size, height, and
                  tilt to find your look.
                </p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <strong>Keep the moment</strong>
                <p>
                  Save a snapshot, then download it from Saved looks. Your uploads and snapshots
                  stay in this browser.
                </p>
              </div>
            </li>
          </ol>
          <div className="help-note">
            <ShieldCheck size={20} />
            <p>
              Camera frames are processed on your device. Camera access needs HTTPS or localhost.
              This is a front-facing 2D preview; side views, physical fit, clothing, and 3D assets
              are not supported yet.
            </p>
          </div>
          <button className="primary-button full-width" onClick={() => setHelpOpen(false)}>
            Meet your next favorite <ArrowRight size={16} />
          </button>
        </Dialog>
      )}
    </div>
  );
}

function AccessoryCard({
  item,
  selected,
  onSelect,
}: {
  item: Accessory;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      className={`accessory-card ${selected ? 'selected' : ''}`}
      aria-pressed={selected}
      aria-label={`Try on ${item.name}`}
      onClick={onSelect}
    >
      <div className="accessory-image">
        <img src={item.image} alt="" />
        {selected && (
          <span className="selected-check">
            <Check size={11} strokeWidth={2.8} />
          </span>
        )}
        {item.source === 'upload' && <span className="upload-badge">YOURS</span>}
      </div>
      <div className="accessory-info">
        <strong>{item.name}</strong>
        <span>{item.color}</span>
      </div>
    </button>
  );
}

function Range({
  label,
  value,
  min,
  max,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="range-control">
      <span>
        {label}
        <output>
          {value > 0 && label !== 'Size' ? '+' : ''}
          {value}
          {unit}
        </output>
      </span>
      <div>
        <Minus size={11} />
        <input
          type="range"
          aria-label={label}
          min={min}
          max={max}
          value={value}
          style={
            { '--range-progress': `${((value - min) / (max - min)) * 100}%` } as React.CSSProperties
          }
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <Plus size={11} />
      </div>
    </label>
  );
}

function Dialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      className="dialog"
      ref={ref}
      aria-labelledby={titleId}
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          const rect = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom
          )
            onClose();
        }
      }}
    >
      <button className="dialog-close" aria-label="Close dialog" onClick={onClose}>
        <X size={21} />
      </button>
      <div className="eyebrow">
        <Sparkles size={13} /> A LITTLE MORE YOU
      </div>
      <h2 id={titleId}>{title}</h2>
      {children}
    </dialog>
  );
}

function UploadDialog({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (item: Accessory) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [preview, setPreview] = useState('');
  const [removeBackground, setRemoveBackground] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function selectFile(next?: File) {
    if (!next) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(next.type)) {
      setError('Please choose a PNG, JPEG, or WebP image.');
      return;
    }
    if (next.size > 10 * 1024 * 1024) {
      setError('Choose an image smaller than 10 MB.');
      return;
    }
    setFile(next);
    setName(
      next.name
        .replace(/\.[^.]+$/, '')
        .replace(/[_-]/g, ' ')
        .slice(0, 60),
    );
    setError('');
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!file || busy) return;
    setBusy(true);
    setError('');
    try {
      const image = await prepareAccessory(file, removeBackground);
      onAdd({
        id: crypto.randomUUID(),
        name: name.trim() || 'My new pair',
        image,
        source: 'upload',
        color: 'Your own find',
        shape: 'Custom eyewear',
      });
      onClose();
    } catch (cause) {
      setError(errorMessage(cause));
      setBusy(false);
    }
  }

  return (
    <Dialog title="A pair that’s all you." onClose={onClose}>
      <p className="dialog-description">Found your perfect frames? Bring them along.</p>
      <form onSubmit={submit}>
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          hidden
          aria-label="Accessory image"
          onChange={(event) => selectFile(event.target.files?.[0])}
        />
        <button
          type="button"
          className={`file-drop ${dragging ? 'dragging' : ''} ${file ? 'has-file' : ''}`}
          disabled={busy}
          onClick={() => input.current?.click()}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            selectFile(event.dataTransfer.files[0]);
          }}
        >
          {file && preview ? (
            <>
              <img src={preview} alt="Your accessory upload" />
              <span>Choose a different image</span>
            </>
          ) : (
            <>
              <span className="file-drop-icon">
                <Upload size={25} strokeWidth={1.3} />
              </span>
              <strong>Drop your frames here</strong>
              <span>
                or <u>browse files</u>
              </span>
              <small>PNG, JPEG or WebP · up to 10 MB</small>
            </>
          )}
        </button>
        <div className="upload-tip">
          <Glasses size={17} />
          <span>
            Use a front-facing product photo. Transparent or plain, light backgrounds work best.
          </span>
        </div>
        <label className="field-label">
          Give your pair a name
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={60}
            placeholder="My new favorite"
            disabled={busy}
          />
        </label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={removeBackground}
            onChange={(event) => setRemoveBackground(event.target.checked)}
            disabled={busy}
          />
          <span>
            <strong>Remove a light background</strong>
            <small>Locally clears light, neutral edges. Transparent images stay transparent.</small>
          </span>
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="primary-button full-width" type="submit" disabled={!file || busy}>
          {busy ? (
            <>
              <LoaderCircle className="spinning" size={17} /> Preparing your pair…
            </>
          ) : (
            <>
              Add to my collection <ArrowRight size={16} />
            </>
          )}
        </button>
        <p className="upload-private">
          <ShieldCheck size={13} /> Prepared and saved on your device. Always.
        </p>
      </form>
    </Dialog>
  );
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}
