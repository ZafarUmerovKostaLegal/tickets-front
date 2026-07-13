export type ChatAttachment = {
    id: number;
    file_name: string;
    content_type: string;
    size_bytes: number;
};

export type ChatReplyTo = {
    message_id: number;
    author_user_id: number;
    body: string;
    is_deleted: boolean;
};

export type ChatReaction = {
    emoji: string;
    count: number;
    user_ids: number[];
};

export type ChatPollOption = {
    index: number;
    text: string;
    votes: number;
    voter_ids: number[];
};

export type ChatPoll = {
    id: number;
    kind: 'poll' | 'quiz';
    question: string;
    options: ChatPollOption[];
    allows_multiple: boolean;
    is_anonymous: boolean;
    is_closed: boolean;
    correct_option_index: number | null;
    explanation: string | null;
    total_voters: number;
    my_votes: number[];
};

export type ChatMessage = {
    id: number;
    room_id: number;
    author_user_id: number;
    message_kind: string;
    body: string;
    created_at: string;
    edited_at: string | null;
    is_deleted: boolean;
    attachments: ChatAttachment[];
    reply_to: ChatReplyTo | null;
    reactions: ChatReaction[];
    poll: ChatPoll | null;
};

export type ChatRoom = {
    id: number;
    slug: string | null;
    title: string;
    room_type: string;
    my_role: string;
    last_message: ChatMessage | null;
    unread_count: number;
    is_company_channel: boolean;
    is_channel: boolean;
    can_post: boolean;
};

export type CreatePollInput = {
    kind: 'poll' | 'quiz';
    question: string;
    options: string[];
    allowsMultiple?: boolean;
    isAnonymous?: boolean;
    correctOptionIndex?: number;
    explanation?: string;
    replyToMessageId?: number;
};

export type ChatRoomMember = {
    user_id: number;
    role: string;
    joined_at: string;
};
