/* eslint-disable */

export interface Ticket {
    id: string;
    ticketNumber: string;
    subject: string;
    description: string;
    customerId: string | undefined;
    customerEmail: string;
    customerName: string;
    status: string;
    priority: string;
    category: string;
    assignedTo?: string;
    createdAt: Date;
    updatedAt: Date;
    lastActivity?: Date;
    slaDueDate?: Date;
    tags: string[];
    isEscalated: boolean;   
    escalationReason?: string;
    resolution?: string;
    closedAt?: Date;
    closedBy?: string;
    messages?: TicketMessage[];
}

export interface TicketMessage {
    id: string;
    ticketId: string;
    authorId: string;
    authorName: string;
    authorType: 'customer' | 'agent' | 'system';
    content: string;
    isInternal: boolean;
    attachments: string[];
    createdAt: Date;
    updatedAt: Date;
}

export interface TicketStatus {
    id: string;
    name: string;
    color: string;
    description?: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface TicketPriority {
    id: string;
    name: string;
    color: string;
    slaHours: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface TicketCategory {
    id: string;
    name: string;
    description?: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface SupportAgent {
    id: string;
    name: string;
    email: string;
    role: 'agent' | 'senior_agent' | 'supervisor';
    isActive: boolean;
    currentTickets: number;
    maxTickets: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface SupportEmailTemplate {
    id: string;
    name: string;
    subject: string;
    content: string;
    isActive: boolean;
    category: string;
    variables: string[];
    createdAt: Date;
    updatedAt: Date;
}

export interface CreateTicketRequest {
    subject: string;
    description: string;
    category: string;
    priority: string;
    customerEmail: string;
    customerName: string;
    tags?: string[];
}

export interface UpdateTicketRequest {
    status?: string;
    priority?: string;
    category?: string;
    assignedTo?: string;
    tags?: string[];
    escalationReason?: string;
    resolution?: string;
}

export interface AddMessageRequest {
    content: string;
    isInternal?: boolean;
    attachments?: string[];
}

export interface TicketFilters {
    page?: number;
    limit?: number;
    status?: string[];
    priority?: string[];
    category?: string[];
    assignedTo?: string[];
    search?: string;
    dateRange?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

export interface TicketStatistics {
    totalTickets: number;
    openTickets: number;
    resolvedTickets: number;
    averageResolutionTime: number;
    ticketsByStatus: Record<string, number>;
    ticketsByPriority: Record<string, number>;
    agentWorkload: Record<string, number>;
}

export interface PaginatedResponse<T> {
    data: T[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
    };
}
