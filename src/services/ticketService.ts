/* eslint-disable */

import { PrismaClient } from '@prisma/client';
import {
    Ticket,
    TicketMessage,
    TicketStatus,
    TicketPriority,
    TicketCategory,
    SupportAgent,
    SupportEmailTemplate,
    CreateTicketRequest,
    UpdateTicketRequest,
    AddMessageRequest,
    TicketFilters,
    TicketStatistics,
    PaginatedResponse
} from '../interfaces/ticket';

const prisma = new PrismaClient();

// Generate ticket number
export const generateTicketNumber = async (): Promise<string> => {
    const lastTicket = await prisma.ticket.findFirst({
        orderBy: { createdAt: 'desc' }
    });

    if (!lastTicket) {
        return 'TKT-001';
    }

    const lastNumber = parseInt(lastTicket.ticketNumber.replace('TKT-', ''));
    const nextNumber = lastNumber + 1;
    return `TKT-${nextNumber.toString().padStart(3, '0')}`;
}

// Calculate SLA due date based on priority
export const calculateSLADueDate = (priority: string): Date => {
    const now = new Date();
    let hours: number;

    switch (priority.toLowerCase()) {
        case 'urgent':
            hours = 4;
            break;
        case 'high':
            hours = 24;
            break;
        case 'medium':
            hours = 48;
            break;
        case 'low':
            hours = 72;
            break;
        default:
            hours = 48;
    }

    return new Date(now.getTime() + hours * 60 * 60 * 1000);
}

// Get all tickets with pagination and filters
export const getTickets = async (filters: TicketFilters): Promise<PaginatedResponse<Ticket>> => {
    const {
        page = 1,
        limit = 20,
        status,
        priority,
        category,
        assignedTo,
        search,
        dateRange,
        sortBy = 'createdAt',
        sortOrder = 'desc'
    } = filters;

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    if (status && status.length > 0) {
        where.status = { in: status };
    }

    if (priority && priority.length > 0) {
        where.priority = { in: priority };
    }

    if (category && category.length > 0) {
        where.category = { in: category };
    }

    if (assignedTo && assignedTo.length > 0) {
        where.assignedTo = { in: assignedTo };
    }

    if (search) {
        where.OR = [
            { subject: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } }
        ];
    }

    if (dateRange) {
        try {
            const dateRangeObj = JSON.parse(dateRange);
            if (dateRangeObj.start && dateRangeObj.end) {
                where.createdAt = {
                    gte: new Date(dateRangeObj.start),
                    lte: new Date(dateRangeObj.end)
                };
            }
        } catch (error) {
            console.error('Invalid date range format:', error);
        }
    }

    // Get total count
    const total = await prisma.ticket.count({ where });

    // Get tickets
    const tickets = await prisma.ticket.findMany({
        where,
        include: {
            // assignedAgent: true,
            messages: {
                orderBy: { createdAt: 'desc' },
                take: 1
            }
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit
    });

    const totalPages = Math.ceil(total / limit);

    return {
        // @ts-ignore
        data: tickets.map(ticket => ({
            ...ticket,
            customerId: '', // Will be populated when schema is fixed
            customerEmail: '', // Will be populated when schema is fixed
            customerName: '', // Will be populated when schema is fixed
            lastActivity: ticket.messages[0]?.createdAt || ticket.updatedAt,
            assignedTo: ticket.assignedTo || undefined
        })),
        pagination: {
            page,
            limit,
            total,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1
        }
    };
}

// Get single ticket
export const getTicket = async (id: string | number): Promise<Ticket | null> => {
    const ticket = await prisma.ticket.findUnique({
        // @ts-ignore
        where: { id },
        include: {
            // assignedAgent: true,
            messages: {
                orderBy: { createdAt: 'asc' }
            }
        }
    });

    if (!ticket) return null;
    // @ts-ignore
    return {
        ...ticket,
        customerId: '', // Will be populated when schema is fixed
        customerEmail: '', // Will be populated when schema is fixed
        customerName: '', // Will be populated when schema is fixed
        // @ts-ignore
        lastActivity: ticket.messages[ticket.messages.length - 1]?.createdAt || ticket.updatedAt
    };
}

// Create new ticket
export const createTicket = async (data: CreateTicketRequest): Promise<Ticket> => {
    const ticketNumber = await generateTicketNumber();
    const slaDueDate = calculateSLADueDate(data.priority);

    // Find or create customer user
    let customerUser = await prisma.user.findFirst({
        where: { email: data.customerEmail }
    });

    const ticket = await prisma.ticket.create({
        // @ts-ignore
        data: {
            ticketNumber,
            subject: data.subject,
            description: data.description,
            status: 'Sent',
            customerId: customerUser?.id.toString() || "",
            customerEmail: customerUser?.email.toString() || "",
            customerName: customerUser?.name.toString() || "",
            priority: data.priority,
            category: data.category,
            tags: data.tags || [],
            slaDueDate,
            lastActivity: new Date()
        },
    });
    // @ts-ignore
    return {
        ...ticket,
        customerId: customerUser?.id?.toString() || "",
        customerEmail: data.customerEmail,
        customerName: data.customerName,
        lastActivity: ticket.lastActivity || ticket.createdAt
    };
}

// Update ticket
export const updateTicket = async (id: string, data: UpdateTicketRequest): Promise<Ticket | null> => {
    const updateData: any = { ...data };

    if (data.priority) {
        updateData.slaDueDate = calculateSLADueDate(data.priority);
    }

    updateData.lastActivity = new Date();

    const ticket = await prisma.ticket.update({
        // @ts-ignore
        where: { id },
        data: updateData,
        // include: {
        //     assignedAgent: true
        // }
    });
    // @ts-ignore
    return {
        ...ticket,
        customerId: '', // Will be populated when schema is fixed
        customerEmail: '', // Will be populated when schema is fixed
        customerName: '', // Will be populated when schema is fixed
        lastActivity: ticket.lastActivity || ticket.updatedAt
    };
}

// Delete ticket (soft delete)
export const deleteTicket = async (id: string): Promise<boolean> => {
    try {
        await prisma.ticket.delete({
            // @ts-ignore
            where: { id }
        });
        return true;
    } catch (error) {
        console.error('Error deleting ticket:', error);
        return false;
    }
}

// Get ticket messages
export const getTicketMessages = async (
    ticketId: string,
    page: number = 1,
    limit: number = 50,
    includeInternal: boolean = false
): Promise<PaginatedResponse<TicketMessage>> => {
    const skip = (page - 1) * limit;

    const where: any = { ticketId };
    if (!includeInternal) {
        where.isInternal = false;
    }

    const total = await prisma.ticketMessages.count({ where });

    const messages = await prisma.ticketMessages.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        skip,
        take: limit
    });

    const totalPages = Math.ceil(total / limit);

    return {
        // @ts-ignore
        data: messages,
        pagination: {
            page,
            limit,
            total,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1
        }
    };
}

// Add message to ticket
export const addMessage = async (ticketId: string, data: AddMessageRequest, authorId: string, authorName: string): Promise<TicketMessage> => {
    const message = await prisma.ticketMessages.create({
        data: {
            // @ts-ignore
            ticketId,
            // @ts-ignore
            authorId,
            authorName,
            authorType: 'agent',
            content: data.content,
            isInternal: data.isInternal || false,
            attachments: data.attachments || []
        }
    });

    // Update ticket last activity
    await prisma.ticket.update({
        // @ts-ignore
        where: { id: ticketId },
        data: { lastActivity: new Date() }
    });

    // @ts-ignore
    return message;
}

// Escalate ticket
export const escalateTicket = async (id: string, reason: string): Promise<Ticket | null> => {
    const ticket = await prisma.ticket.update({
        // @ts-ignore
        where: { id },
        data: {
            isEscalated: true,
            escalationReason: reason,
            lastActivity: new Date()
        },
        // include: {
        //     assignedAgent: true
        // }
    });

    // @ts-ignore
    return {
        ...ticket,
        customerId: '', // Will be populated when schema is fixed
        customerEmail: '', // Will be populated when schema is fixed
        customerName: '', // Will be populated when schema is fixed
        lastActivity: ticket.lastActivity || ticket.updatedAt
    };
}

// Close ticket
export const closeTicket = async (id: string, resolution: string, closedBy: string): Promise<Ticket | null> => {
    const ticket = await prisma.ticket.update({
        // @ts-ignore
        where: { id },
        data: {
            status: 'Closed',
            resolution,
            closedAt: new Date(),
            // @ts-ignore
            closedBy,
            lastActivity: new Date()
        },
        // include: {
        //     assignedAgent: true
        // }
    });

    // @ts-ignore
    return {
        ...ticket,
        customerId: '', // Will be populated when schema is fixed
        customerEmail: '', // Will be populated when schema is fixed
        customerName: '', // Will be populated when schema is fixed
        lastActivity: ticket.lastActivity || ticket.updatedAt
    };
}

// Reopen ticket
export const reopenTicket = async (id: string, reason: string): Promise<Ticket | null> => {
    const ticket = await prisma.ticket.update({

        where: { id: id },
        data: {
            status: 'Open',
            resolution: null,
            closedAt: null,
            closedBy: null,
            lastActivity: new Date()
        },
        // include: {
        //     assignedAgent: true
        // }
    });
    // @ts-ignore
    return {
        ...ticket,
        customerId: '', // Will be populated when schema is fixed
        customerEmail: '', // Will be populated when schema is fixed
        customerName: '', // Will be populated when schema is fixed
        lastActivity: ticket.lastActivity || ticket.updatedAt
    };
}

// Get ticket statuses
export const getTicketStatuses = async (): Promise<TicketStatus[]> => {
    // @ts-ignore
    return await prisma.ticketStatus.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' }
    });
}

// Get ticket priorities
export const getTicketPriorities = async (): Promise<TicketPriority[]> => {
    return await prisma.ticketPriority.findMany({
        orderBy: { slaHours: 'asc' }
    });
}

// Get ticket categories
export const getTicketCategories = async (): Promise<TicketCategory[]> => {
    // @ts-ignore
    return await prisma.ticketCategory.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' }
    });
}

// Get support agents
export const getSupportAgents = async (): Promise<SupportAgent[]> => {
    // @ts-ignore
    return await prisma.supportAgent.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' }
    });
}

// Update agent workload
export const updateAgentWorkload = async (agentId: number, maxTickets: number): Promise<SupportAgent | null> => {
    // @ts-ignore
    return await prisma.supportAgent.update({
        where: { id: agentId },
        data: { maxTickets }
    });
}

// Get ticket statistics
export const getTicketStatistics = async (dateRange?: string): Promise<TicketStatistics> => {
    const where: any = {};

    if (dateRange) {
        try {
            const dateRangeObj = JSON.parse(dateRange);
            if (dateRangeObj.start && dateRangeObj.end) {
                where.createdAt = {
                    gte: new Date(dateRangeObj.start),
                    lte: new Date(dateRangeObj.end)
                };
            }
        } catch (error) {
            console.error('Invalid date range format:', error);
        }
    }

    const [
        totalTickets,
        openTickets,
        resolvedTickets,
        ticketsByStatus,
        ticketsByPriority,
        agentWorkload
    ] = await Promise.all([
        prisma.ticket.count({ where }),
        prisma.ticket.count({ where: { ...where, status: { not: 'Closed' } } }),
        prisma.ticket.count({ where: { ...where, status: 'Resolved' } }),
        prisma.ticket.groupBy({
            by: ['status'],
            where,
            _count: { status: true }
        }),
        prisma.ticket.groupBy({
            by: ['priority'],
            where,
            _count: { priority: true }
        }),
        prisma.supportAgents.findMany({
            where: { isActive: true },
            select: {
                name: true,
                currentTickets: true
            }
        })
    ]);

    // Calculate average resolution time
    const resolvedTicketsData = await prisma.ticket.findMany({
        where: { ...where, status: 'Resolved', closedAt: { not: null } },
        select: {
            createdAt: true,
            closedAt: true
        }
    });

    let averageResolutionTime = 0;
    if (resolvedTicketsData.length > 0) {
        const totalHours = resolvedTicketsData.reduce((sum: number, ticket: any) => {
            const hours = (ticket.closedAt!.getTime() - ticket.createdAt.getTime()) / (1000 * 60 * 60);
            return sum + hours;
        }, 0);
        averageResolutionTime = totalHours / resolvedTicketsData.length;
    }

    return {
        totalTickets,
        openTickets,
        resolvedTickets,
        averageResolutionTime,
        // ts-ignore
        ticketsByStatus: ticketsByStatus.reduce((acc: any, item: any) => {
            // ts-ignore
            acc[item.status] = item._count.status;
            return acc;
        }, {} as Record<string, number>),
        // ts-ignore
        ticketsByPriority: ticketsByPriority.reduce((acc: any, item: any) => {
            // ts-ignore
            acc[item.priority] = item._count.priority;
            return acc;
        }, {} as Record<string, number>),
        // ts-ignore
        agentWorkload: agentWorkload.reduce((acc: any, agent: any) => {
            // ts-ignore
            acc[agent.name] = agent.currentTickets;
            return acc;
        }, {} as Record<string, number>)
    };
}

// Get all support email templates
export const getSupportEmailTemplates = async (): Promise<SupportEmailTemplate[]> => {
    // @ts-ignore
    return await prisma.supportEmailTemplate.findMany({
    });
    // where: { isActive: true },
    // // orderBy: { name: 'asc' }
}

// Get single support email template
export const getSupportEmailTemplate = async (id: string): Promise<SupportEmailTemplate | null> => {
    // @ts-ignore
    return await prisma.supportEmailTemplate.findUnique({
        where: { id }
    });
}

// Create support email template
export const createSupportEmailTemplate = async (data: {
    name: string;
    subject: string;
    content: string;
    isActive?: boolean;
    category?: string;
    variables: string[];
}): Promise<SupportEmailTemplate> => {
    // @ts-ignore
    return await prisma.supportEmailTemplate.create({
        data: {
            name: data.name,
            subject: data.subject,
            content: data.content,
            isActive: data.isActive ?? true,
            category: data.category ?? 'support',
            variables: data.variables
        }
    });
}

// Update support email template
export const updateSupportEmailTemplate = async (
    id: string,
    data: {
        name?: string;
        subject?: string;
        content?: string;
        isActive?: boolean;
        variables?: string[];
    }
): Promise<SupportEmailTemplate | null> => {
    // @ts-ignore
    return await prisma.supportEmailTemplate.update({
        where: { id },
        data
    });
}

// Delete support email template
export const deleteSupportEmailTemplate = async (id: string): Promise<boolean> => {
    try {
        await prisma.supportEmailTemplate.delete({
            where: { id }
        });
        return true;
    } catch (error) {
        console.error('Error deleting support email template:', error);
        return false;
    }
}

// Send support email
export const sendSupportEmail = async (data: {
    templateId: string;
    ticketId: string;
    recipientEmail: string;
    recipientName: string;
    customVariables?: Record<string, string>;
}): Promise<{
    id: string;
    templateId: string;
    recipientEmail: string;
    subject: string;
    content: string;
    sentAt: Date;
    status: 'sent' | 'failed';
}> => {
    // Get the template
    const template = await getSupportEmailTemplate(data.templateId);
    if (!template) {
        throw new Error('Email template not found');
    }

    // Get ticket information
    const ticket = await prisma.ticket.findUnique({
        where: { id: data.ticketId },
        // include: {
        //     assignedAgent: true
        // }
    });

    if (!ticket) {
        throw new Error('Ticket not found');
    }

    // Replace variables in subject and content
    let subject = template.subject;
    let content = template.content;

    const variables = {
        userName: data.recipientName,
        ticketNumber: ticket.ticketNumber,
        ticketSubject: ticket.subject,
        ticketDescription: ticket.description,
        ticketStatus: ticket.status,
        ticketPriority: ticket.priority,
        ticketCategory: ticket.category,
        // assignedAgent: ticket?.assignedAgent?.name || 'Unassigned',
        supportEmail: 'support@longo.com', // This should come from settings
        ...data.customVariables
    };

    // Replace variables in subject
    Object.entries(variables).forEach(([key, value]) => {
        const regex = new RegExp(`{{${key}}}`, 'g');
        subject = subject.replace(regex, value);
    });

    // Replace variables in content
    Object.entries(variables).forEach(([key, value]) => {
        const regex = new RegExp(`{{${key}}}`, 'g');
        content = content.replace(regex, value);
    });

    // Here you would integrate with your email service
    // For now, we'll just return the processed email data
    const emailData = {
        id: `email_${Date.now()}`,
        templateId: data.templateId,
        recipientEmail: data.recipientEmail,
        subject,
        content,
        sentAt: new Date(),
        status: 'sent' as const
    };

    // TODO: Integrate with actual email service (SMTP, SendGrid, etc.)
    console.log('Sending support email:', emailData);

    return emailData;
}
