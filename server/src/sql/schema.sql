-- ===================== USERS & ROLES =====================

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    last_name VARCHAR(50) NOT NULL,
    first_name VARCHAR(50) NOT NULL,
    patronymic VARCHAR(50),
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    employee_permissions JSONB DEFAULT '{
        "can_manage_bookings": false,
        "can_manage_cash": false,
        "can_manage_services": false,
        "can_view_reports": false,
        "can_manage_schedule": false,
        "can_manage_employees": false,
        "can_do_washing": false
    }'::jsonb
);

CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    role_name VARCHAR(50) UNIQUE NOT NULL,
    role_description TEXT
);

INSERT INTO roles (role_name, role_description) VALUES 
('guest', 'Неавторизованный посетитель'),
('client', 'Зарегистрированный клиент'),
('employee', 'Сотрудник (с настраиваемыми правами)'),
('admin', 'Администратор (полный доступ)')
ON CONFLICT (role_name) DO NOTHING;

CREATE TABLE IF NOT EXISTS user_roles (
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);

-- ===================== SERVICES =====================

CREATE TABLE IF NOT EXISTS services (
    id SERIAL PRIMARY KEY,
    service_name VARCHAR(100) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    duration_minutes INT NOT NULL,
    wash_type VARCHAR(20) DEFAULT 'manual'
);

CREATE TABLE IF NOT EXISTS extra_services (
    id SERIAL PRIMARY KEY,
    service_name VARCHAR(100) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    duration_minutes INT NOT NULL
);

-- ===================== BOXES & SCHEDULE =====================

CREATE TABLE IF NOT EXISTS boxes (
    id SERIAL PRIMARY KEY,
    box_number VARCHAR(10) NOT NULL UNIQUE,
    is_active BOOLEAN DEFAULT TRUE,
    wash_type VARCHAR(20) DEFAULT 'manual'
);

CREATE TABLE IF NOT EXISTS schedule (
    id SERIAL PRIMARY KEY,
    appointment_time TIMESTAMP NOT NULL,
    is_available BOOLEAN DEFAULT TRUE,
    box_id INTEGER REFERENCES boxes(id)
);

-- ===================== BOOKINGS =====================

CREATE TABLE IF NOT EXISTS bookings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    service_id INTEGER NOT NULL REFERENCES services(id),
    schedule_id INTEGER NOT NULL REFERENCES schedule(id),
    box_id INTEGER REFERENCES boxes(id),
    car_info VARCHAR(100),
    status VARCHAR(20) NOT NULL DEFAULT 'confirmed',
    is_paid BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    actual_arrival BOOLEAN,
    UNIQUE(schedule_id, box_id)
);

CREATE TABLE IF NOT EXISTS booking_extra_services (
    booking_id INTEGER REFERENCES bookings(id) ON DELETE CASCADE,
    extra_service_id INTEGER REFERENCES extra_services(id) ON DELETE CASCADE,
    PRIMARY KEY (booking_id, extra_service_id)
);

-- ===================== CASH =====================

CREATE TABLE IF NOT EXISTS cash_operations (
    id SERIAL PRIMARY KEY,
    type VARCHAR(20) NOT NULL CHECK (type IN ('income', 'expense')),
    amount DECIMAL(10, 2) NOT NULL,
    description TEXT,
    date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_id INTEGER REFERENCES users(id)
);

-- ===================== AI =====================

CREATE TABLE IF NOT EXISTS ai_predictions (
    id SERIAL PRIMARY KEY,
    schedule_id INTEGER NOT NULL REFERENCES schedule(id),
    prediction_date DATE NOT NULL,
    predicted_occupancy FLOAT NOT NULL,
    confidence FLOAT
);

-- ===================== AUDIT =====================

CREATE TABLE IF NOT EXISTS audit_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    action_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    action_type VARCHAR(50) NOT NULL,
    target TEXT,
    result BOOLEAN
);
