import { IconClose } from './TodoIcons';
type TodoAddCardModalProps = {
  columnTitle: string;
  title: string;
  onTitleChange: (v: string) => void;
  onClose: () => void;
  onSubmit: () => void;
};
export function TodoAddCardModal({ columnTitle, title, onTitleChange, onClose, onSubmit, }: TodoAddCardModalProps) {
  return (<div className="todo-add-card-modal-backdrop">
    <div className="todo-add-card-modal" role="dialog" aria-modal="true" aria-labelledby="todo-add-card-modal-title">
      <div className="todo-add-card-modal__head">
        <h2 id="todo-add-card-modal-title" className="todo-add-card-modal__title">
          {columnTitle}
        </h2>
        <button type="button" className="todo-add-card-modal__close" aria-label="Закрыть" onClick={onClose}>
          <IconClose />
        </button>
      </div>
      <input type="text" className="todo-add-card-modal__input" placeholder="Введите название или вставьте ссылку" value={title} onChange={(e) => onTitleChange(e.target.value)} onKeyDown={(e) => {
        if (e.key === 'Escape')
          onClose();
        if (e.key === 'Enter')
          onSubmit();
      }} autoFocus />
      <div className="todo-add-card-modal__footer">
        <button type="button" className="todo-add-card-modal__submit" onClick={onSubmit}>
          Добавить карточку
        </button>
      </div>
    </div>
  </div>);
}
