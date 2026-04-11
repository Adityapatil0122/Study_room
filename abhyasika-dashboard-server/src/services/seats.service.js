import { AppError } from "../utils/AppError.js";
import { randomUUID } from "crypto";
import { query, queryOne, withTransaction } from "../db/connection.js";
import { recordAudit } from "./audit.service.js";
import { assignSeatToStudent, clearStudentSeat } from "./students.service.js";

export async function listSeats(workspaceOwnerId) {
  const rows = await query(
    `
      SELECT *
      FROM seats
      WHERE workspace_owner_id = ?
      ORDER BY seat_number ASC
    `,
    [workspaceOwnerId]
  );

  return rows;
}

async function getSeatOrThrow(seatId, workspaceOwnerId, connection) {
  const row = await queryOne(
    "SELECT * FROM seats WHERE id = ? AND workspace_owner_id = ? LIMIT 1",
    [seatId, workspaceOwnerId],
    connection
  );

  if (!row) {
    throw new AppError("Seat not found", 404);
  }

  return row;
}

export async function assignSeat(workspaceOwnerId, seatId, studentId, audit = null) {
  return withTransaction(async (connection) => {
    const seat = await getSeatOrThrow(seatId, workspaceOwnerId, connection);
    if (seat.status === "maintenance") {
      throw new AppError("Seat is under maintenance", 400);
    }
    if (seat.current_student_id) {
      throw new AppError("Seat is already occupied", 400);
    }

    const student = await queryOne(
      `
        SELECT id, name, current_seat_id
        FROM students
        WHERE id = ? AND workspace_owner_id = ?
        LIMIT 1
      `,
      [studentId, workspaceOwnerId],
      connection
    );

    if (!student) {
      throw new AppError("Student not found", 404);
    }
    if (student.current_seat_id) {
      throw new AppError("Student already has an assigned seat", 400);
    }

    await query(
      `
        UPDATE seats
        SET status = 'occupied', current_student_id = ?
        WHERE id = ? AND workspace_owner_id = ?
      `,
      [studentId, seatId, workspaceOwnerId],
      connection
    );

    const updatedStudent = await assignSeatToStudent(studentId, workspaceOwnerId, seatId, connection);
    const updatedSeat = await queryOne("SELECT * FROM seats WHERE id = ?", [seatId], connection);

    await recordAudit(
      {
        workspaceOwnerId,
        objectType: "seats",
        objectId: seatId,
        action: "assign",
        actorId: audit?.actor_id,
        actorRole: audit?.actor_role,
        metadata: { student_id: studentId, seat_number: seat.seat_number },
      },
      connection
    );

    await recordAudit(
      {
        workspaceOwnerId,
        objectType: "students",
        objectId: studentId,
        action: "seat-assigned",
        actorId: audit?.actor_id,
        actorRole: audit?.actor_role,
        metadata: { seat_id: seatId, seat_number: seat.seat_number },
      },
      connection
    );

    return { seat: updatedSeat, student: updatedStudent };
  });
}

export async function deallocateSeat(workspaceOwnerId, seatId, audit = null) {
  return withTransaction(async (connection) => {
    const seat = await getSeatOrThrow(seatId, workspaceOwnerId, connection);

    await query(
      `
        UPDATE seats
        SET status = 'available', current_student_id = NULL
        WHERE id = ? AND workspace_owner_id = ?
      `,
      [seatId, workspaceOwnerId],
      connection
    );

    let updatedStudent = null;
    if (seat.current_student_id) {
      updatedStudent = await clearStudentSeat(seat.current_student_id, workspaceOwnerId, connection);
    }

    await recordAudit(
      {
        workspaceOwnerId,
        objectType: "seats",
        objectId: seatId,
        action: "deallocate",
        actorId: audit?.actor_id,
        actorRole: audit?.actor_role,
        metadata: {
          previous_student_id: seat.current_student_id,
          seat_number: seat.seat_number,
        },
      },
      connection
    );

    if (seat.current_student_id) {
      await recordAudit(
        {
          workspaceOwnerId,
          objectType: "students",
          objectId: seat.current_student_id,
          action: "seat-removed",
          actorId: audit?.actor_id,
          actorRole: audit?.actor_role,
          metadata: {
            seat_id: seatId,
            seat_number: seat.seat_number,
          },
        },
        connection
      );
    }

    const updatedSeat = await queryOne("SELECT * FROM seats WHERE id = ?", [seatId], connection);
    return { seat: updatedSeat, student: updatedStudent };
  });
}

export async function createSeat(workspaceOwnerId, payload = {}, audit = null, connection) {
  const seatNumber = payload.seat_number?.trim();
  if (!seatNumber) {
    throw new AppError("Seat number is required", 400);
  }

  const normalizedSeatNumber = seatNumber.toUpperCase();
  const existing = await queryOne(
    `
      SELECT id
      FROM seats
      WHERE workspace_owner_id = ? AND seat_number = ?
      LIMIT 1
    `,
    [workspaceOwnerId, normalizedSeatNumber],
    connection
  );

  if (existing) {
    throw new AppError("Seat number already exists", 409);
  }

  const seatId = randomUUID();
  await query(
    `
      INSERT INTO seats (
        id,
        workspace_owner_id,
        seat_number,
        status
      ) VALUES (?, ?, ?, ?)
    `,
    [seatId, workspaceOwnerId, normalizedSeatNumber, payload.status ?? "available"],
    connection
  );

  await recordAudit(
    {
      workspaceOwnerId,
      objectType: "seats",
      objectId: seatId,
      action: "create",
      actorId: audit?.actor_id,
      actorRole: audit?.actor_role,
      metadata: { seat_number: normalizedSeatNumber },
    },
    connection
  );

  return queryOne("SELECT * FROM seats WHERE id = ?", [seatId], connection);
}
