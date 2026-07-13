export type UserPublic = {
    id: number;
    email: string;
    display_name: string | null;
    picture: string | null;
    position: string | null;
    is_archived: boolean;
};

export type UsersPublicBatchResponse = {
    items: UserPublic[];
    missing_ids: number[];
};
