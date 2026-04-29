import { IconClose } from './TodoIcons';
type TodoAddColumnModalProps = {
    title: string;
    onTitleChange: (v: string) => void;
    onClose: () => void;
    onSubmit: () => void;
};
export function TodoAddColumnModal({ title, onTitleChange, onClose, onSubmit }: TodoAddColumnModalProps) {
    return (<div className="todo-add-card-modal-backdrop">
      <div className="todo-add-card-modal" role="dialog" aria-modal="true" aria-labelledby="todo-add-column-modal-title">
        <div className="todo-add-card-modal__head">
          <h2 id="todo-add-column-modal-title" className="todo-add-card-modal__title">
            Новая колонка
          </h2>
          <button type="button" className="todo-add-card-modal__close" aria-label="Закрыть" onClick={onClose}>
            <IconClose />
          </button>
        </div>
        <input type="text" className="todo-add-card-modal__input" placeholder="Название колонки" value={title} onChange={(e) => onTitleChange(e.target.value)} onKeyDown={(e) => {
            if (e.key === 'Escape')
                onClose();
            if (e.key === 'Enter')
                onSubmit();
        }} autoFocus/>
        <div className="todo-add-card-modal__footer">
          <button type="button" className="todo-add-card-modal__submit" onClick={onSubmit}>
            Добавить колонку
          </button>
        </div>
      </div>
    </div>);
}
