import { useState, type DragEvent, type KeyboardEvent } from 'react';
import type { BrowseFolder, ClientNode, Location } from '../api';
import { buildFolderTree, folderPath, locationKey, type FolderNode } from '../explorer';
import { locationLabel } from '../naming';
import { Icon } from './icons';

export type FolderState = BrowseFolder[] | 'loading' | { error: string };

type Matter = ClientNode['matters'][number];

type Props = {
  clients: ClientNode[];
  autoExpand: boolean;
  expanded: ReadonlySet<string>;
  onToggle: (key: string) => void;
  folders: Readonly<Record<string, FolderState>>;
  selectedKey: string | null;
  dropKey: string | null;
  favorites: ReadonlySet<string>;
  onSelect: (location: Location) => void;
  onFavorite: (kind: 'matter' | 'folder', id: string, matterId: string, on: boolean) => void;
  onCreateFolder: (matterId: string, parentId: string | null, name: string) => Promise<void>;
  onDropFiles: (location: Location, files: File[]) => void;
};

function canWrite(matter: Matter): boolean {
  return (matter.level === 'edit' || matter.level === 'manage') && !matter.closed;
}

export function matterLocation(client: ClientNode, matter: Matter, rows: readonly BrowseFolder[] | null, folderId: string | null): Location {
  return {
    matterId: matter.id,
    matterName: matter.name,
    matterCode: matter.code,
    clientId: client.id,
    clientName: client.name,
    folderId,
    folderPath: rows ? folderPath(rows, folderId) : [],
  };
}

function hasFiles(event: DragEvent): boolean {
  return Array.from(event.dataTransfer?.types ?? []).includes('Files');
}

export function FolderTree(props: Props) {
  const [creating, setCreating] = useState<{ matterId: string; parentId: string | null } | null>(null);
  const [draft, setDraft] = useState('');
  const [nativeDrop, setNativeDrop] = useState<string | null>(null);

  if (!props.clients.length)
    return <p className="kf-empty">Ничего не найдено. Проверьте название или код matter.</p>;

  const dropHandlers = (location: Location, writable: boolean) => (writable ? {
    onDragOver: (event: DragEvent) => {
      if (!hasFiles(event))
        return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
      setNativeDrop(locationKey(location));
    },
    onDragLeave: () => setNativeDrop((key) => (key === locationKey(location) ? null : key)),
    onDrop: (event: DragEvent) => {
      if (!hasFiles(event))
        return;
      event.preventDefault();
      setNativeDrop(null);
      const files = Array.from(event.dataTransfer.files);
      if (files.length)
        props.onDropFiles(location, files);
    },
  } : {});

  const submitFolder = async () => {
    if (!creating)
      return;
    const name = draft.trim();
    if (!name) {
      setCreating(null);
      return;
    }
    await props.onCreateFolder(creating.matterId, creating.parentId, name);
    setCreating(null);
    setDraft('');
  };

  const newFolderInput = (depth: number) => (
    <li className="kf-tree__new" style={{ paddingLeft: `${depth * 14 + 26}px` }}>
      <Icon name="folder" />
      <input
        autoFocus
        className="kf-input kf-input--inline"
        value={draft}
        placeholder="Название папки"
        aria-label="Название новой папки"
        maxLength={300}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
          if (event.key === 'Enter')
            void submitFolder();
          if (event.key === 'Escape') {
            setCreating(null);
            setDraft('');
          }
        }}
        onBlur={() => void submitFolder()}
      />
    </li>
  );

  const renderFolders = (client: ClientNode, matter: Matter, rows: BrowseFolder[], nodes: FolderNode[], depth: number) => nodes.map((node) => {
    const key = `f:${node.id}`;
    const open = props.expanded.has(key);
    const location = matterLocation(client, matter, rows, node.id);
    const lkey = locationKey(location);
    const selected = props.selectedKey === lkey;
    const dropping = props.dropKey === lkey || nativeDrop === lkey;
    const writable = canWrite(matter);
    const favorite = props.favorites.has(`folder:${node.id}`);
    return (
      <li key={node.id} role="none">
        <div
          className={`kf-tree__row${selected ? ' is-selected' : ''}${dropping ? ' is-drop' : ''}`}
          style={{ paddingLeft: `${depth * 14 + 4}px` }}
          data-drop-matter={writable ? matter.id : undefined}
          data-drop-folder={writable ? node.id : undefined}
          {...dropHandlers(location, writable)}
        >
          <button
            type="button"
            className="kf-tree__twist"
            aria-label={open ? 'Свернуть' : 'Развернуть'}
            aria-expanded={node.children.length ? open : undefined}
            disabled={!node.children.length}
            onClick={() => props.onToggle(key)}
          >
            {node.children.length ? <Icon name="chevron" size={12} className={open ? 'is-open' : ''} /> : null}
          </button>
          <button type="button" role="treeitem" aria-selected={selected} className="kf-tree__label" title={locationLabel(location)} onClick={() => props.onSelect(location)}>
            <Icon name={open ? 'folderOpen' : 'folder'} className="kf-tree__glyph kf-tree__glyph--folder" />
            <span className="kf-tree__name">{node.name}</span>
            {node.documents ? <span className="kf-tree__count">{node.documents}</span> : null}
          </button>
          <span className="kf-tree__tools">
            {writable ? (
              <button type="button" className="kf-iconbtn" title="Новая папка внутри" aria-label={`Новая папка в «${node.name}»`} onClick={() => {
                setCreating({ matterId: matter.id, parentId: node.id });
                setDraft('');
                if (!open)
                  props.onToggle(key);
              }}>
                <Icon name="plus" size={14} />
              </button>
            ) : null}
            <button
              type="button"
              className={`kf-iconbtn${favorite ? ' is-on' : ''}`}
              title={favorite ? 'Убрать из избранного' : 'В избранное'}
              aria-pressed={favorite}
              aria-label="Избранное"
              onClick={() => props.onFavorite('folder', node.id, matter.id, !favorite)}
            >
              <Icon name={favorite ? 'starOn' : 'star'} size={14} />
            </button>
          </span>
        </div>
        {open || (creating?.parentId === node.id) ? (
          <ul role="group" className="kf-tree__group">
            {creating?.matterId === matter.id && creating.parentId === node.id ? newFolderInput(depth + 1) : null}
            {renderFolders(client, matter, rows, node.children, depth + 1)}
          </ul>
        ) : null}
      </li>
    );
  });

  const renderMatter = (client: ClientNode, matter: Matter) => {
    const key = `m:${matter.id}`;
    const open = props.expanded.has(key);
    const state = props.folders[matter.id];
    const rows = Array.isArray(state) ? state : null;
    const location = matterLocation(client, matter, rows, null);
    const lkey = locationKey(location);
    const selected = props.selectedKey === lkey;
    const writable = canWrite(matter);
    const favorite = props.favorites.has(`matter:${matter.id}`);
    const dropping = props.dropKey === lkey || nativeDrop === lkey;
    return (
      <li key={matter.id} role="none">
        <div
          className={`kf-tree__row kf-tree__row--matter${selected ? ' is-selected' : ''}${dropping ? ' is-drop' : ''}${matter.closed ? ' is-closed' : ''}`}
          style={{ paddingLeft: '18px' }}
          data-drop-matter={writable ? matter.id : undefined}
          {...dropHandlers(location, writable)}
        >
          <button type="button" className="kf-tree__twist" aria-label={open ? 'Свернуть matter' : 'Показать папки'} aria-expanded={open} onClick={() => props.onToggle(key)}>
            <Icon name="chevron" size={12} className={open ? 'is-open' : ''} />
          </button>
          <button
            type="button"
            role="treeitem"
            aria-selected={selected}
            className="kf-tree__label"
            title={[`${matter.code ? `${matter.code} · ` : ''}${matter.name}`, client.name, matter.closed ? 'Закрыт' : ''].filter(Boolean).join('\n')}
            onClick={() => props.onSelect(location)}
          >
            <Icon name="matter" className="kf-tree__glyph kf-tree__glyph--matter" />
            <span className="kf-tree__name">
              {matter.code ? <span className="kf-code">{matter.code}</span> : null}
              {matter.name}
            </span>
            {matter.closed ? <span className="kf-tag">закрыт</span> : !writable ? <span className="kf-tag">чтение</span> : null}
          </button>
          <span className="kf-tree__tools">
            {writable ? (
              <button type="button" className="kf-iconbtn" title="Новая папка" aria-label={`Новая папка в matter «${matter.name}»`} onClick={() => {
                setCreating({ matterId: matter.id, parentId: null });
                setDraft('');
                if (!open)
                  props.onToggle(key);
              }}>
                <Icon name="plus" size={14} />
              </button>
            ) : null}
            <button
              type="button"
              className={`kf-iconbtn${favorite ? ' is-on' : ''}`}
              title={favorite ? 'Убрать из избранного' : 'В избранное'}
              aria-pressed={favorite}
              aria-label="Избранное"
              onClick={() => props.onFavorite('matter', matter.id, matter.id, !favorite)}
            >
              <Icon name={favorite ? 'starOn' : 'star'} size={14} />
            </button>
          </span>
        </div>
        {open ? (
          <ul role="group" className="kf-tree__group">
            {creating?.matterId === matter.id && creating.parentId === null ? newFolderInput(1) : null}
            {state === 'loading' || state === undefined ? <li className="kf-tree__hint">Загрузка папок…</li> : null}
            {state && !Array.isArray(state) && state !== 'loading' ? <li className="kf-tree__hint is-error">{state.error}</li> : null}
            {rows ? renderFolders(client, matter, rows, buildFolderTree(rows), 1) : null}
            {rows && !rows.length ? <li className="kf-tree__hint">Папок нет — сохраните в корень или создайте папку</li> : null}
          </ul>
        ) : null}
      </li>
    );
  };

  return (
    <ul className="kf-tree" role="tree" aria-label="Клиенты, matters и папки">
      {props.clients.map((client) => {
        const key = `c:${client.id}`;
        const open = props.autoExpand || props.expanded.has(key);
        return (
          <li key={client.id} role="none">
            <div className="kf-tree__row kf-tree__row--client">
              <button type="button" className="kf-tree__twist" aria-label={open ? 'Свернуть клиента' : 'Развернуть клиента'} aria-expanded={open} onClick={() => props.onToggle(key)}>
                <Icon name="chevron" size={12} className={open ? 'is-open' : ''} />
              </button>
              <button type="button" role="treeitem" aria-expanded={open} className="kf-tree__label" title={`${client.name}\nMatters: ${client.matters.length}`} onClick={() => props.onToggle(key)}>
                <Icon name="client" className="kf-tree__glyph kf-tree__glyph--client" />
                <span className="kf-tree__name">{client.name}</span>
                <span className="kf-tree__count">{client.matters.length}</span>
              </button>
            </div>
            {open ? <ul role="group" className="kf-tree__group">{client.matters.map((matter) => renderMatter(client, matter))}</ul> : null}
          </li>
        );
      })}
    </ul>
  );
}
