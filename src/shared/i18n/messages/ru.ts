import type { TodoPageMessages } from '../todoPageMessages';
import type { TimeTrackingPageMessages } from '../timeTrackingPageMessages';
import type { ContactsPageMessages } from '../contactsPageMessages';


const timeTrackingPageStub = {} as TimeTrackingPageMessages;
const todoPageStub = {} as TodoPageMessages;
const contactsPageStub = {} as ContactsPageMessages;

export const ruMessages: Messages = {
    brand: {
        title: 'Тикет-система',
        subtitle: 'Kosta Legal',
        windowTitle: 'Тикет-система · Kosta Legal',
        homeAria: 'На главную · Kosta Legal',
    },
    common: {
        goTo: 'Перейти',
        cancel: 'Отмена',
        user: 'Пользователь',
        department: 'Отдел',
        loading: '…',
    },
    homeHub: {
        reorderHint: 'Перетащите плитку за ручку ⋮⋮, чтобы изменить порядок',
        dragTileAria: 'Изменить порядок',
        unreadMessagesAria: '{count} непрочитанных сообщений',
        forReviewPendingBadgeAria: '{count} отчётов ожидают вашей подписи',
        internalPortal: 'Внутренний портал',
        searchPlaceholder: 'Найти раздел…',
        searchEmpty: 'Разделы не найдены',
        greetingSubtitle: 'Выберите нужный раздел ниже или воспользуйтесь поиском в шапке.',
        greeting: {
            morning: 'Доброе утро',
            afternoon: 'Доброго дня',
            evening: 'Добрый вечер',
        },
        sections: {
            daily: 'Ежедневная работа',
            finance: 'Документы и финансы',
            team: 'Команда и ресурсы',
        },
    },
    kostaLegalAi: {
        heroTitle: 'С чего начнём?',
        queryLabel: 'Запрос к Kosta Legal AI',
        queryPlaceholder: 'Юридический поиск, анализ и формулировки',
        attachFile: 'Прикрепить файл',
        webSearch: 'Поиск в интернете',
        lawArea: 'Сфера права',
        sources: 'Источники',
        send: 'Отправить запрос',
        commandsTitle: 'Готовые команды',
        commandsSubtitle: 'Сокращают путь от запроса до результата — всё нужное уже настроено.',
        commandsAll: 'Все',
        sidebar: {
            navAria: 'Навигация Kosta Legal AI',
            collapse: 'Свернуть боковую панель',
            expand: 'Развернуть боковую панель',
            createSmartFolder: 'Создать умную папку',
            howToUse: 'Как пользоваться',
            allSmartFolders: 'Все умные папки',
            createChat: 'Создать чат',
            aiTag: 'AI ассистент',
            brandName: 'Kosta Legal',
        },
        lawAreas: {
            civil: 'Гражданское',
            labor: 'Трудовое',
            tax: 'Налоговое',
            corporate: 'Корпоративное',
            ip: 'Интеллектуальная собственность',
        },
        commands: {
            spellCheck: {
                title: 'Проверка правописания',
                description: 'Исправляет орфографию и пунктуацию в тексте',
            },
            caseLaw: {
                title: 'Подбор судебной практики',
                description: 'Находит решения по теме или обстоятельствам дела',
            },
            adCheck: {
                title: 'Проверка рекламных материалов',
                description: 'Анализирует риски в креативах и текстах',
            },
            ocr: {
                title: 'Распознавание текста',
                description: 'Извлекает текст из файлов и сканов',
            },
            claimResponse: {
                title: 'Ответ на претензию',
                description: 'Анализирует переписку и готовит ответ',
            },
            contractAnalysis: {
                title: 'Комплексный анализ договора',
                description: 'Выявляет ключевые условия, сроки и риски',
            },
            styleChange: {
                title: 'Смена стиля текста',
                description: 'Меняет тон с официального на простой и обратно',
            },
            legalDesign: {
                title: 'Дизайн юридических документов',
                description: 'Проверяет структуру, язык и техническое оформление',
            },
        },
    },
    nav: {
        home: 'Главная',
        timeTracking: 'Учёт времени',
        expenses: 'Расходы',
        expensesPartners: 'Расходы партнёров',
        todo: 'Список дел',
        tickets: 'IT-заявки',
        correspondence: 'Корреспонденция',
        accounting: 'Бухгалтерия',
        kostaDaily: 'Kosta Daily',
        vacationSchedule: 'График отпусков',
        inventory: 'Инвентаризация',
        admin: 'Админ-панель',
        networkDrive: 'Сетевой диск',
        attendance: 'Посещаемость',
        callSchedule: 'Расписание звонков',
        rules: 'Правила',
        help: 'Помощь',
        contacts: 'Контакты',
        internalCommunication: 'Внутренняя связь',
        kostaLegalAi: 'Kosta Legal AI',
        sectionsAria: 'Разделы приложения',
    },
    pageTitle: {
        login: 'Вход',
        authCallback: 'Выполняется вход',
        ticket: 'Заявка',
        project: 'Проект',
        newProject: 'Новый проект',
        reportPreview: 'Предпросмотр отчёта',
        invoicePreview: 'Предпросмотр счёта',
        invoiceCreate: 'Новый счёт',
        invoiceDetail: 'Счёт',
        user: 'Пользователь',
        expensesRequests: 'Заявки на расходы',
        expensesReport: 'Отчёт по расходам',
        expensesPartners: 'Расходы партнёров',
        expensesPartnersReport: 'Отчёт по расходам партнёров',
    },
    header: {
        themeLight: 'Светлая тема',
        themeDark: 'Тёмная тема',
        themeOnly: 'Тема оформления',
        themeAndProfile: 'Тема оформления и профиль',
        language: 'Язык интерфейса',
        languageRu: 'Русский',
        languageEn: 'English',
        userMenu: 'Меню пользователя',
        logout: 'Выйти',
        logoutTitle: 'Выйти из аккаунта?',
        logoutText: 'Сессия будет завершена. Потом нужно будет снова войти в систему.',
        logoutConfirm: 'Выйти',
    },
    sidebar: {
        navAria: 'Навигация',
        expand: 'Развернуть меню',
        collapse: 'Свернуть меню',
        expandShort: 'Развернуть',
        collapseShort: 'Свернуть',
        closeMobile: 'Закрыть меню',
    },
    app: {
        startupError: 'Не удалось загрузить данные. Проверьте подключение и повторите попытку.',
        errorPage: {
            tab: 'дело — соединение',
            caseNo: 'ДЕЛО № {id}',
            filedAt: 'подано {time}',
            act: 'Акт о сбое',
            titleNetwork: 'Связь с сервером прервана',
            titleSession: 'Сессия пользователя истекла',
            titleForbidden: 'Доступ к сервису ограничен',
            titleServer: 'На сервере временные неполадки',
            titleGeneric: 'Что-то пошло не так',
            bodyNetwork:
                'Портал не получил ответ от сервера в отведённое время. Причиной может быть сеть, VPN или истекшая сессия — детали в чеклисте справа.',
            bodySession: 'Сессия истекла. Выйдите и войдите снова или повторите попытку.',
            bodyForbidden: 'Нет доступа к сервису. Обратитесь к администратору.',
            bodyServer: 'На сервере временные неполадки. Попробуйте позже.',
            bodyGeneric: 'Не удалось загрузить данные. Проверьте подключение к интернету или повторите попытку.',
            stamp: 'ПОВТОР ТРЕБУЕТСЯ',
            tagServer: 'СЕРВЕР',
            tagNetwork: 'СЕТЬ',
            tagSession: 'СЕССИЯ',
            checkedTitle: 'Что проверено',
            check: {
                internet: 'Подключение к интернету',
                internetOk: 'активно',
                internetBad: 'нет связи',
                vpn: 'VPN и прокси',
                vpnUnknown: 'не определено',
                session: 'Сессия пользователя',
                sessionExpired: 'истекла',
                sessionUnverified: 'не подтверждена',
            },
            retry: 'Повторить попытку',
            logout: 'Выйти из аккаунта',
        },
    },
    helpPage: {
        title: 'Помощь',
        heroTitle: 'Как мы можем помочь?',
        heroText:
            'Ответы на частые вопросы по офисным задачам: подключение принтера, Wi‑Fi, второго монитора и другое. Не нашли ответ — создайте тикет.',
        faqHeading: 'Офисные задачи',
        faqAria: 'Часто задаваемые вопросы',
        questionLabel: 'Вопрос',
        answerLabel: 'Ответ',
        faq: {
            printer: {
                question: 'Как подключить принтер?',
                answer:
                    'Создайте тикет с темой «Подключение принтера». Укажите модель принтера, кабинет и способ подключения (USB или сеть). IT-специалист установит драйверы и настроит печать.',
            },
            wifi: {
                question: 'Не подключается Wi‑Fi. Что делать?',
                answer:
                    'Проверьте, что выбран правильный SSID офисной сети. Если пароль не подходит или сеть не отображается — создайте тикет «Проблема с Wi‑Fi» с указанием устройства и кабинета.',
            },
            monitor: {
                question: 'Как подключить второй монитор к ноутбуку?',
                answer:
                    'Подключите кабель HDMI или DisplayPort к разъёмам ноутбука и монитора. В Windows нажмите Win+P и выберите «Дублировать» или «Расширить». Если монитор не определяется — проверьте кабель и драйверы видеокарты, при необходимости создайте тикет.',
            },
            access: {
                question: 'Как получить доступ к системе или папке?',
                answer:
                    'Создайте тикет «Выдача доступа» с указанием системы или пути к папке и обоснованием. Запрос согласуется с руководителем, после чего доступ выдаётся IT-отделом.',
            },
            supplies: {
                question: 'Как заказать канцтовары или картриджи?',
                answer:
                    'Оформите тикет «Заявка на канцтовары» или «Замена картриджа». Укажите наименование, количество и кабинет. Заявки обрабатываются в порядке поступления.',
            },
            support: {
                question: 'Куда обращаться при других проблемах?',
                answer: '',
            },
        },
    },
    rulesPage: {
        title: 'Правила',
        subtitle: 'Правила оформления заявок',
        heroTitle: 'Как правильно оформлять заявки',
        heroText:
            'Рекомендации по IT-заявкам, расходам, отпускам и другим обращениям в системе — чтобы их быстрее согласовали и обрабатывали.',
        sections: {
            createTicket: {
                title: 'Создание IT-заявки',
                text: 'Откройте раздел «IT-заявки» и создайте новую заявку. Укажите тему, подробное описание, приоритет и при необходимости приложите файлы. После отправки заявка поступает в очередь IT-отдела.',
            },
            description: {
                title: 'Описание тикета',
                text: 'Опишите суть проблемы или задачи понятным языком: что произошло, где и когда, какой результат нужен. Избегайте общих формулировок вроде «не работает» без деталей.',
            },
            priority: {
                title: 'Приоритет и статус',
                text: 'Выбирайте приоритет по срочности влияния на работу. Следите за статусом заявки и отвечайте на уточняющие вопросы IT-специалиста.',
            },
            attachments: {
                title: 'Вложения к тикету',
                text: 'Прикрепляйте скриншоты ошибок, логи, документы и другие файлы, которые помогут воспроизвести проблему или понять задачу.',
            },
            expenseRequest: {
                title: 'Заявка на расход',
                text: 'В разделе «Расходы» создайте заявку: укажите дату, сумму, тип расхода, проект или категорию (если нужно), назначение платежа и приложите чек или платёжный документ. Проверьте данные и отправьте на согласование; при возврате на доработку внесите правки и отправьте снова.',
            },
            vacationRequest: {
                title: 'Заявление на отпуск и отсутствие',
                text: 'В «Графике отпусков» нажмите «+», выберите категорию (ежегодный отпуск, неоплачиваемый отпуск, дистанционный режим), период и партнёра для согласования. Проверьте текст заявления, подпишите его и при необходимости скачайте PDF или Word. Число дней в периоде считается автоматически.',
            },
        },
    },
    internalCommunicationPage: {
        title: 'Внутренняя связь',
        subtitle: 'Внутренние телефонные номера сотрудников',
        searchPlaceholder: 'Поиск по ФИО или номеру…',
        colName: 'ФИО сотрудника',
        colExtension: 'Внутренний номер',
        empty: 'Сотрудники не найдены',
        emptyDirectory: 'Список внутренних номеров пока не заполнен',
        emptyHint: 'Попробуйте изменить поисковый запрос',
        count: 'Сотрудников: {count}',
    },
    attendancePage: {
        title: 'Посещаемость',
        subtitle: 'Время прихода и ухода сотрудников, отработанные часы',
        settingsLoading: 'Загрузка настроек…',
        settings: 'Настройки',
        refresh: 'Обновить',
        retry: 'Повторить',
        reportTitle: 'Отчёт по посещаемости',
        searchDaily: 'ФИО или email…',
        searchLegacy: 'Введите ФИО или имя…',
        periodFrom: 'Период с',
        periodTo: 'по',
        type: 'Тип',
        reset: 'Сброс',
        excel: 'Excel',
        close: 'Закрыть',
        selectPlaceholder: 'Выберите',
        filterAll: 'Все',
        filter: {
            allRecords: 'Все записи',
            lateOnly: 'Только опоздания',
            overtimeOnly: 'Только переработки',
            onTime: 'Вовремя',
            late: 'Опоздания',
            absent: 'Отсутствуют',
        },
        table: {
            date: 'Дата',
            employee: 'Сотрудник',
            arrival: 'Приход',
            departure: 'Уход',
            checkpoint: 'Точка прохода',
            explanation: 'Объяснение',
            unmapped: 'не привязан',
            unmappedHint: 'Пользователь Hikvision не связан с учётной записью в системе',
        },
        arrival: {
            absent: 'Не пришёл',
            late: 'Опоздал',
            onTime: 'Вовремя',
        },
        explain: {
            opening: 'Открытие…',
            openPhoto: 'Открыть фото',
            uploading: 'Загрузка…',
            upload: 'Загрузить объяснение',
            invalidFile: 'Допустимы только файлы: JPG, PNG, WebP, GIF.',
            uploadFailed: 'Не удалось загрузить файл',
            openFailed: 'Не удалось открыть фото',
            photoAlt: 'Объяснительная',
            photoDialog: 'Фото объяснительной',
        },
        empty: {
            title: 'Нет данных о посещаемости',
            desc: 'Убедитесь, что сервис attendance запущен и доступен.',
        },
        kpi: {
            entries: 'Записей',
            late: 'Опозданий',
            lateDaily: 'Опоздали',
            overtime: 'Переработок',
            hours: 'Всего часов',
            tracked: 'В учёте',
            onTime: 'Вовремя',
            absent: 'Отсутствуют',
            entriesSub: 'за выбранный период',
            lateSub: 'после {startTime} + {lateMinutes} мин',
            overtimeSub: 'больше {dailyHours} ч в день',
            hoursSub: '≈ {avgHours} ч / запись',
            trackedSub: 'сотрудников с маппингом на камеры',
            ontimeSub: 'первый проход до границы опоздания',
            absentSub: 'нет событий за выбранный день',
        },
        settingsModal: {
            title: 'Настройки рабочего дня',
            desc: 'Предел опоздания, норма часов и переработка',
            start: 'Начало рабочего дня',
            end: 'Конец рабочего дня',
            lateMinutes: 'Предел опоздания (минут)',
            lateHint: 'Приход после начала дня + это кол-во минут = опоздание',
            dailyHours: 'Норма часов в день',
            dailyHint: 'Работа больше этого времени = переработка',
            cancel: 'Отмена',
            save: 'Сохранить',
            saving: 'Сохранение…',
            saveFailed: 'Не удалось сохранить настройки',
        },
        hikvisionModal: {
            open: 'Привязка пользователей Hikvision',
            openShort: 'Привязка',
            title: 'Привязка Hikvision к пользователям системы',
            desc: 'Свяжите сотрудников с камер с реальными учётными записями в системе',
            search: 'Поиск по имени на камере…',
            searchBtn: 'Найти',
            loading: 'Загрузка…',
            empty: 'Нет пользователей с камер',
            loadFailed: 'Не удалось загрузить данные',
            saveFailed: 'Не удалось сохранить привязку',
            resetFailed: 'Не удалось сбросить привязку',
            selectUser: 'Выберите пользователя системы для привязки',
            metricUsers: 'На камерах: {count}',
            metricCameras: 'Камер: {count}',
            metricMapped: 'Привязано: {count}',
            colCamera: 'Камера',
            colEmployeeNo: '№ на камере',
            colHikvisionName: 'Имя на камере',
            colDepartment: 'Отдел',
            colSystemUser: 'Пользователь системы',
            colActions: 'Действия',
            unlinked: 'Не привязано',
            noUsers: 'Нет пользователей в системе',
            noMatch: 'Не найдено',
            save: 'Сохранить',
            saving: 'Сохранение…',
            saved: 'Сохранено',
            reset: 'Сбросить',
            resetting: 'Сброс…',
        },
        errors: {
            loadFailed: 'Ошибка загрузки',
            settingsLoadFailed: 'Не удалось загрузить настройки',
        },
        datePicker: {
            placeholder: 'Выберите дату',
            prevMonth: 'Предыдущий месяц',
            nextMonth: 'Следующий месяц',
            weekdays: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
        },
        export: {
            statusColumn: 'Статус',
            statusOnTime: 'Вовремя',
            statusLate: 'Опоздание',
            statusAbsent: 'Отсутствует',
        },
    },
    ticketsPage: {
        back: 'Назад',
        backAria: 'Назад',
        hideNotifications: 'Скрыть уведомления',
        showNotifications: 'Показать уведомления',
        newTicket: 'Новая заявка',
        newTicketAria: 'Новая заявка',
        sectionTitleAll: 'Заявки пользователей',
        sectionTitleMine: 'Мои заявки',
        filterStatus: 'Статус',
        filterPriority: 'Приоритет',
        allStatuses: 'Все статусы',
        allPriorities: 'Все приоритеты',
        resetFilters: 'Сбросить',
        searchPlaceholder: 'Поиск...',
        searchAria: 'Поиск заявок',
        errLoadTickets: 'Ошибка загрузки заявок',
        errCreateTicket: 'Ошибка создания заявки',
        loadFailedTitle: 'Не удалось загрузить',
        retry: 'Повторить',
        emptyTitle: 'Заявок пока нет',
        emptyDescCreate: 'Создайте первую заявку',
        emptyDescNone: 'У вас пока нет заявок',
        notFoundTitle: 'Ничего не найдено',
        notFoundDesc: 'Попробуйте изменить запрос',
        thTicket: 'Заявка',
        thAuthor: 'Автор',
        thPriority: 'Приоритет',
        thStatus: 'Статус',
        thDate: 'Дата',
        statusNew: 'Новая',
        selectCategory: 'Выберите',
        noName: 'Без имени',
        stats: {
            total: 'Всего заявок',
            inProgress: 'В работе',
            closed: 'Закрытые',
            impossible: 'Невозможно',
        },
        priority: {
            high: 'Высокий',
            medium: 'Средний',
            low: 'Низкий',
        },
        categories: {
            hardware: 'Техника',
            network: 'Сеть',
            software: 'Программное обеспечение',
            equipment: 'Оборудование',
            access: 'Доступы',
            general: 'Общее',
        },
        create: {
            title: 'Новая заявка',
            theme: 'Тема',
            themePlaceholder: 'О чём заявка?',
            description: 'Описание',
            descriptionPlaceholder: 'Подробно опишите проблему или запрос',
            status: 'Статус',
            category: 'Категория',
            priority: 'Приоритет',
            attachment: 'Вложение',
            attachmentHint: 'до 15 МБ',
            dropzonePrefix: 'Перетащите или',
            dropzoneLink: 'выберите файл',
            submitting: 'Отправка…',
            create: 'Создать',
        },
    },
    ticketDetailPage: {
        errNoUuid: 'Не указан идентификатор заявки.',
        errLoad: 'Не удалось загрузить заявку',
        errNoAccess: 'Нет доступа к этой заявке.',
        notFound: 'Заявка не найдена',
        errStatus: 'Не удалось сменить статус',
        errStatusForbidden: 'Нет прав на изменение статуса этой заявки.',
        errThemeRequired: 'Укажите тему заявки',
        errSave: 'Не удалось сохранить',
        errSaveForbidden: 'Нет прав на редактирование этой заявки.',
        errComment: 'Не удалось отправить комментарий',
        errFileLoad: 'Не удалось загрузить файл',
        errFileOpen: 'Не удалось открыть файл',
        themeAria: 'Тема заявки',
        description: 'Описание',
        edit: 'Редактировать',
        descriptionPlaceholder: 'Описание заявки',
        descriptionEmpty: 'Описание не указано',
        saving: 'Сохранение…',
        save: 'Сохранить',
        attachment: 'Вложение',
        attachmentCurrent: 'Текущий файл',
        attachmentNew: 'Новый файл',
        removeAttachment: 'Удалить вложение',
        preview: 'Предпросмотр',
        previewLoading: 'Загрузка превью…',
        closePreview: 'Закрыть',
        openInNewTab: 'В новой вкладке',
        download: 'Скачать',
        openFile: 'Открыть файл',
        comments: 'Комментарии',
        commentsEmpty: 'Комментариев пока нет',
        commentPlaceholder: 'Написать комментарий…',
        commentSubmitting: 'Отправка…',
        commentSubmit: 'Отправить',
        info: 'Информация',
        labelStatus: 'Статус',
        labelPriority: 'Приоритет',
        labelCategory: 'Категория',
        labelAuthor: 'Автор',
        labelCreated: 'Создана',
        priorityAria: 'Приоритет',
        categoryAria: 'Категория',
        loading: 'Загрузка…',
    },
    todoPage: todoPageStub,
    timeTrackingPage: timeTrackingPageStub,
    contactsPage: contactsPageStub,
    callSchedulePage: {
        title: 'Расписание звонков',
        subtitleDefault: 'Календарь: события из Microsoft 365',
        subtitleMailboxPrefix: 'Календари ящика',
        alertCalendars: 'Календари.',
        alertEvents: 'События.',
        retry: 'Повторить запрос',
        railNavAria: 'Навигация по календарю',
        prevMonth: 'Предыдущий месяц',
        nextMonth: 'Следующий месяц',
        miniCalendarAria: 'Мини-календарь',
        calendarSection: 'Календарь',
        dataHint: 'Данные: gateway',
        today: 'Сегодня',
        newSlot: 'Новый слот',
        monthView: 'Месяц',
        loading: 'Загрузка…',
        mainCalendarAria: 'Месячный календарь',
        allDayEventsTitle: 'Все события дня',
        allDayEventsAria: 'Все',
        eventDetailsTitle: 'подробнее',
        moreInDayTitle: 'Всего в дне:',
        moreInDayTitleSuffix: 'Нажмите, чтобы открыть список.',
        showHiddenAria: 'Показать скрытые:',
        moreCount: 'Ещё',
        close: 'Закрыть',
        closeAria: 'Закрыть',
        labelDate: 'Дата',
        labelTime: 'Время',
        labelClient: 'Клиент / проект',
        labelParticipants: 'Участники',
        labelDescription: 'Описание',
        labelJoinLinks: 'Ссылки на встречу',
        linkUnavailable: '(ссылка недоступна)',
        linkUnsafeTitle: 'Ссылка не HTTPS или некорректна',
        labelPhone: 'Телефон',
        newCallSlot: 'Новый слот звонка',
        formSubject: 'Тема',
        formSubjectPlaceholder: 'Напр., Звонок с клиентом',
        formDate: 'Дата',
        formFrom: 'С',
        formTo: 'По',
        formBody: 'Текст приглашения (по желанию)',
        formBodyPlaceholder: 'Заметка для участников',
        cancel: 'Отмена',
        create: 'Создать',
        creating: 'Создание…',
        errSubject: 'Укажите тему встречи',
        errDate: 'Некорректная дата',
        errTime: 'Некорректное время',
        errEndBeforeStart: 'Время окончания должно быть позже начала',
        errCreateEvent: 'Не удалось создать событие',
        errLoadCalendars: 'Не удалось загрузить календари',
        errLoadEvents: 'Не удалось загрузить события',
        calendarShow: 'Показать',
        calendarListAria: 'Календарь для просмотра',
        calendarDefault: 'Основной (default)',
        openM365Kosta: 'Открыть Kosta Legal в Microsoft 365',
        openM365: 'Открыть календарь в Microsoft 365',
        duration: {
            min: 'мин',
            hour: 'ч',
        },
        events: {
            one: 'событие',
            few: 'события',
            many: 'событий',
        },
        weekdays: {
            mon: 'Пн',
            tue: 'Вт',
            wed: 'Ср',
            thu: 'Чт',
            fri: 'Пт',
            sat: 'Сб',
            sun: 'Вс',
        },
        join: {
            teams: 'Открыть в Microsoft Teams',
            zoom: 'Открыть в Zoom',
            meet: 'Открыть в Google Meet',
            webex: 'Открыть в Webex',
            outlook: 'Открыть в Outlook (веб)',
            browser: 'Открыть ссылку встречи в браузере',
            meetingLink: 'Ссылка на встречу',
        },
    },
};

export type Messages = {
    brand: Record<'title' | 'subtitle' | 'windowTitle' | 'homeAria', string>;
    common: Record<'goTo' | 'cancel' | 'user' | 'department' | 'loading', string>;
    homeHub: {
        reorderHint: string;
        dragTileAria: string;
        unreadMessagesAria: string;
        forReviewPendingBadgeAria: string;
        internalPortal: string;
        searchPlaceholder: string;
        searchEmpty: string;
        greetingSubtitle: string;
        greeting: Record<'morning' | 'afternoon' | 'evening', string>;
        sections: Record<'daily' | 'finance' | 'team', string>;
    };
    kostaLegalAi: {
        heroTitle: string;
        queryLabel: string;
        queryPlaceholder: string;
        attachFile: string;
        webSearch: string;
        lawArea: string;
        sources: string;
        send: string;
        commandsTitle: string;
        commandsSubtitle: string;
        commandsAll: string;
        sidebar: {
            navAria: string;
            collapse: string;
            expand: string;
            createSmartFolder: string;
            howToUse: string;
            allSmartFolders: string;
            createChat: string;
            aiTag: string;
            brandName: string;
        };
        lawAreas: Record<'civil' | 'labor' | 'tax' | 'corporate' | 'ip', string>;
        commands: Record<
            | 'spellCheck'
            | 'caseLaw'
            | 'adCheck'
            | 'ocr'
            | 'claimResponse'
            | 'contractAnalysis'
            | 'styleChange'
            | 'legalDesign',
            { title: string; description: string }
        >;
    };
    nav: Record<
        | 'home'
        | 'timeTracking'
        | 'expenses'
        | 'expensesPartners'
        | 'todo'
        | 'tickets'
        | 'correspondence'
        | 'accounting'
        | 'kostaDaily'
        | 'vacationSchedule'
        | 'inventory'
        | 'admin'
        | 'networkDrive'
        | 'attendance'
        | 'callSchedule'
        | 'rules'
        | 'help'
        | 'contacts'
        | 'internalCommunication'
        | 'kostaLegalAi'
        | 'sectionsAria',
        string
    >;
    pageTitle: Record<
        | 'login'
        | 'authCallback'
        | 'ticket'
        | 'project'
        | 'newProject'
        | 'reportPreview'
        | 'invoicePreview'
        | 'invoiceCreate'
        | 'invoiceDetail'
        | 'user'
        | 'expensesRequests'
        | 'expensesReport'
        | 'expensesPartners'
        | 'expensesPartnersReport',
        string
    >;
    header: Record<
        | 'themeLight'
        | 'themeDark'
        | 'themeOnly'
        | 'themeAndProfile'
        | 'language'
        | 'languageRu'
        | 'languageEn'
        | 'userMenu'
        | 'logout'
        | 'logoutTitle'
        | 'logoutText'
        | 'logoutConfirm',
        string
    >;
    sidebar: Record<'navAria' | 'expand' | 'collapse' | 'expandShort' | 'collapseShort' | 'closeMobile', string>;
    app: {
        startupError: string;
        errorPage: {
            tab: string;
            caseNo: string;
            filedAt: string;
            act: string;
            titleNetwork: string;
            titleSession: string;
            titleForbidden: string;
            titleServer: string;
            titleGeneric: string;
            bodyNetwork: string;
            bodySession: string;
            bodyForbidden: string;
            bodyServer: string;
            bodyGeneric: string;
            stamp: string;
            tagServer: string;
            tagNetwork: string;
            tagSession: string;
            checkedTitle: string;
            check: {
                internet: string;
                internetOk: string;
                internetBad: string;
                vpn: string;
                vpnUnknown: string;
                session: string;
                sessionExpired: string;
                sessionUnverified: string;
            };
            retry: string;
            logout: string;
        };
    };
    helpPage: {
        title: string;
        heroTitle: string;
        heroText: string;
        faqHeading: string;
        faqAria: string;
        questionLabel: string;
        answerLabel: string;
        faq: Record<
            'printer' | 'wifi' | 'monitor' | 'access' | 'supplies' | 'support',
            { question: string; answer: string }
        >;
    };
    rulesPage: {
        title: string;
        subtitle: string;
        heroTitle: string;
        heroText: string;
        sections: Record<
            | 'createTicket'
            | 'description'
            | 'priority'
            | 'attachments'
            | 'expenseRequest'
            | 'vacationRequest',
            { title: string; text: string }
        >;
    };
    internalCommunicationPage: {
        title: string;
        subtitle: string;
        searchPlaceholder: string;
        colName: string;
        colExtension: string;
        empty: string;
        emptyDirectory: string;
        emptyHint: string;
        count: string;
    };
    attendancePage: {
        title: string;
        subtitle: string;
        settingsLoading: string;
        settings: string;
        refresh: string;
        retry: string;
        reportTitle: string;
        searchDaily: string;
        searchLegacy: string;
        periodFrom: string;
        periodTo: string;
        type: string;
        reset: string;
        excel: string;
        close: string;
        selectPlaceholder: string;
        filterAll: string;
        filter: Record<
            'allRecords' | 'lateOnly' | 'overtimeOnly' | 'onTime' | 'late' | 'absent',
            string
        >;
        table: Record<'date' | 'employee' | 'arrival' | 'departure' | 'checkpoint' | 'explanation' | 'unmapped' | 'unmappedHint', string>;
        arrival: Record<'absent' | 'late' | 'onTime', string>;
        explain: Record<
            | 'opening'
            | 'openPhoto'
            | 'uploading'
            | 'upload'
            | 'invalidFile'
            | 'uploadFailed'
            | 'openFailed'
            | 'photoAlt'
            | 'photoDialog',
            string
        >;
        empty: Record<'title' | 'desc', string>;
        kpi: Record<
            | 'entries'
            | 'late'
            | 'lateDaily'
            | 'overtime'
            | 'hours'
            | 'tracked'
            | 'onTime'
            | 'absent'
            | 'entriesSub'
            | 'lateSub'
            | 'overtimeSub'
            | 'hoursSub'
            | 'trackedSub'
            | 'ontimeSub'
            | 'absentSub',
            string
        >;
        settingsModal: Record<
            | 'title'
            | 'desc'
            | 'start'
            | 'end'
            | 'lateMinutes'
            | 'lateHint'
            | 'dailyHours'
            | 'dailyHint'
            | 'cancel'
            | 'save'
            | 'saving'
            | 'saveFailed',
            string
        >;
        hikvisionModal: Record<
            | 'open'
            | 'openShort'
            | 'title'
            | 'desc'
            | 'search'
            | 'searchBtn'
            | 'loading'
            | 'empty'
            | 'loadFailed'
            | 'saveFailed'
            | 'resetFailed'
            | 'selectUser'
            | 'metricUsers'
            | 'metricCameras'
            | 'metricMapped'
            | 'colCamera'
            | 'colEmployeeNo'
            | 'colHikvisionName'
            | 'colDepartment'
            | 'colSystemUser'
            | 'colActions'
            | 'unlinked'
            | 'noUsers'
            | 'noMatch'
            | 'save'
            | 'saving'
            | 'saved'
            | 'reset'
            | 'resetting',
            string
        >;
        errors: Record<'loadFailed' | 'settingsLoadFailed', string>;
        datePicker: {
            placeholder: string;
            prevMonth: string;
            nextMonth: string;
            weekdays: readonly string[];
        };
        export: Record<'statusColumn' | 'statusOnTime' | 'statusLate' | 'statusAbsent', string>;
    };
    ticketsPage: {
        back: string;
        backAria: string;
        hideNotifications: string;
        showNotifications: string;
        newTicket: string;
        newTicketAria: string;
        sectionTitleAll: string;
        sectionTitleMine: string;
        filterStatus: string;
        filterPriority: string;
        allStatuses: string;
        allPriorities: string;
        resetFilters: string;
        searchPlaceholder: string;
        searchAria: string;
        errLoadTickets: string;
        errCreateTicket: string;
        loadFailedTitle: string;
        retry: string;
        emptyTitle: string;
        emptyDescCreate: string;
        emptyDescNone: string;
        notFoundTitle: string;
        notFoundDesc: string;
        thTicket: string;
        thAuthor: string;
        thPriority: string;
        thStatus: string;
        thDate: string;
        statusNew: string;
        selectCategory: string;
        noName: string;
        stats: Record<'total' | 'inProgress' | 'closed' | 'impossible', string>;
        priority: Record<'high' | 'medium' | 'low', string>;
        categories: Record<'hardware' | 'network' | 'software' | 'equipment' | 'access' | 'general', string>;
        create: Record<
            | 'title'
            | 'theme'
            | 'themePlaceholder'
            | 'description'
            | 'descriptionPlaceholder'
            | 'status'
            | 'category'
            | 'priority'
            | 'attachment'
            | 'attachmentHint'
            | 'dropzonePrefix'
            | 'dropzoneLink'
            | 'submitting'
            | 'create',
            string
        >;
    };
    ticketDetailPage: {
        errNoUuid: string;
        errLoad: string;
        errNoAccess: string;
        notFound: string;
        errStatus: string;
        errStatusForbidden: string;
        errThemeRequired: string;
        errSave: string;
        errSaveForbidden: string;
        errComment: string;
        errFileLoad: string;
        errFileOpen: string;
        themeAria: string;
        description: string;
        edit: string;
        descriptionPlaceholder: string;
        descriptionEmpty: string;
        saving: string;
        save: string;
        attachment: string;
        attachmentCurrent: string;
        attachmentNew: string;
        removeAttachment: string;
        preview: string;
        previewLoading: string;
        closePreview: string;
        openInNewTab: string;
        download: string;
        openFile: string;
        comments: string;
        commentsEmpty: string;
        commentPlaceholder: string;
        commentSubmitting: string;
        commentSubmit: string;
        info: string;
        labelStatus: string;
        labelPriority: string;
        labelCategory: string;
        labelAuthor: string;
        labelCreated: string;
        priorityAria: string;
        categoryAria: string;
        loading: string;
    };
    todoPage: TodoPageMessages;
    timeTrackingPage: TimeTrackingPageMessages;
    contactsPage: ContactsPageMessages;
    callSchedulePage: {
        title: string;
        subtitleDefault: string;
        subtitleMailboxPrefix: string;
        alertCalendars: string;
        alertEvents: string;
        retry: string;
        railNavAria: string;
        prevMonth: string;
        nextMonth: string;
        miniCalendarAria: string;
        calendarSection: string;
        dataHint: string;
        today: string;
        newSlot: string;
        monthView: string;
        loading: string;
        mainCalendarAria: string;
        allDayEventsTitle: string;
        allDayEventsAria: string;
        eventDetailsTitle: string;
        moreInDayTitle: string;
        moreInDayTitleSuffix: string;
        showHiddenAria: string;
        moreCount: string;
        close: string;
        closeAria: string;
        labelDate: string;
        labelTime: string;
        labelClient: string;
        labelParticipants: string;
        labelDescription: string;
        labelJoinLinks: string;
        linkUnavailable: string;
        linkUnsafeTitle: string;
        labelPhone: string;
        newCallSlot: string;
        formSubject: string;
        formSubjectPlaceholder: string;
        formDate: string;
        formFrom: string;
        formTo: string;
        formBody: string;
        formBodyPlaceholder: string;
        cancel: string;
        create: string;
        creating: string;
        errSubject: string;
        errDate: string;
        errTime: string;
        errEndBeforeStart: string;
        errCreateEvent: string;
        errLoadCalendars: string;
        errLoadEvents: string;
        calendarShow: string;
        calendarListAria: string;
        calendarDefault: string;
        openM365Kosta: string;
        openM365: string;
        duration: Record<'min' | 'hour', string>;
        events: Record<'one' | 'few' | 'many', string>;
        weekdays: Record<'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun', string>;
        join: Record<'teams' | 'zoom' | 'meet' | 'webex' | 'outlook' | 'browser' | 'meetingLink', string>;
    };
};
