import type { CorrDocType, RegisterIncomingBody, RegisterOutgoingBody } from '@entities/correspondence';

export type {
    CorrDirection,
    CorrDocStatus,
    CorrDocType,
    CorrRow,
} from '@entities/correspondence';


export type IncomingRegisterPayload = Omit<RegisterIncomingBody, 'docType'> & {
    partnerName: string;
    type: CorrDocType;
};


export type OutgoingRegisterPayload = Omit<RegisterOutgoingBody, 'docType'> & {
    type: CorrDocType;
};
