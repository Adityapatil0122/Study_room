export const VIEW_DEFINITIONS = [
    {
        id: "dashboard",
        label: "Dashboard",
        icon: "LayoutDashboard",
    },
    {
        id: "students",
        label: "Students",
        icon: "Users2",
    },
    {
        id: "seats",
        label: "Seat Manager",
        icon: "Armchair",
    },
    {
        id: "payments",
        label: "Payments",
        icon: "CreditCard",
    },
    {
        id: "renewals",
        label: "Renewals",
        icon: "CalendarClock",
    },
    {
        id: "reports",
        label: "Reports",
        icon: "BarChart3",
    },
    {
        id: "admissions",
        label: "Admissions",
        icon: "QrCode",
    },
    {
        id: "history",
        label: "History",
        icon: "History",
    },
    {
        id: "expenses",
        label: "Expenses",
        icon: "Wallet2",
    },
    {
        id: "settings",
        label: "Settings",
        icon: "Settings2",
    },
];

export const VIEW_LABELS = VIEW_DEFINITIONS.reduce(
    (acc, view) => ({
        ...acc,
        [view.id]: view.description || view.label,
    }),
    {}
);

export const ALL_VIEW_IDS = VIEW_DEFINITIONS.map((view) => view.id);

export const VIEW_ACTIONS = ["view", "add", "edit", "delete"];

const DEFAULT_ACTION_STATES = {
    view: true,
    add: false,
    edit: false,
    delete: false,
};

export const buildPermissionTemplate = (defaults = DEFAULT_ACTION_STATES) => {
    const template = {};
    VIEW_DEFINITIONS.forEach(({ id }) => {
        template[id] = {};
        VIEW_ACTIONS.forEach((action) => {
            const fallback =
                defaults?.[id]?.[action] ??
                defaults?.[action] ??
                DEFAULT_ACTION_STATES[action] ??
                false;
            template[id][action] = Boolean(fallback);
        });
    });
    return template;
};

export const normalizePermissions = (rawPermissions) => {
    if (!rawPermissions || Object.keys(rawPermissions).length === 0) {
        return buildPermissionTemplate();
    }

    const template = buildPermissionTemplate({
        view: false,
        add: false,
        edit: false,
        delete: false,
    });

    if (Array.isArray(rawPermissions.allowed_views)) {
        rawPermissions.allowed_views.forEach((viewId) => {
            if (template[viewId]) {
                template[viewId].view = true;
            }
        });
    }

    VIEW_DEFINITIONS.forEach(({ id }) => {
        const config = rawPermissions[id];
        if (config && typeof config === "object") {
            VIEW_ACTIONS.forEach((action) => {
                if (typeof config[action] === "boolean") {
                    template[id][action] = config[action];
                }
            });
        }
    });

    return template;
};

export const DEFAULT_FULL_PERMISSIONS = buildPermissionTemplate({
    view: true,
    add: true,
    edit: true,
    delete: true,
});
