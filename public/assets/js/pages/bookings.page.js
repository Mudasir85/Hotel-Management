function setMessage(text, type) {
  const notice = document.getElementById('bookingNotice');
  notice.textContent = text;
  notice.className = `notice ${type || ''}`;
}

async function readJsonSafe(res) {
  try {
    return await res.json();
  } catch (_err) {
    return null;
  }
}

function renderBookingsTableRows(bookings) {
  const tbody = document.getElementById('bookingsBody');
  tbody.innerHTML = '';

  for (const booking of bookings) {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${booking.id}</td>
      <td>${booking.guest_name}</td>
      <td>${booking.guest_phone}</td>
      <td>${booking.room_number}</td>
      <td>${booking.check_in_date}</td>
      <td>${booking.check_out_date}</td>
      <td><button class="btn btn-danger" data-id="${booking.id}" type="button">Delete</button></td>
    `;
    tbody.appendChild(row);
  }
}

async function loadBookings() {
  const res = await fetch('/api/bookings', { credentials: 'same-origin' });
  if (res.status === 401) {
    window.location.href = '/login';
    return;
  }

  if (!res.ok) {
    throw new Error(`Failed to fetch bookings (${res.status})`);
  }

  const data = await readJsonSafe(res);
  if (!Array.isArray(data)) {
    throw new Error('Invalid bookings response');
  }

  renderBookingsTableRows(data);
}

async function onCreateBooking(event) {
  event.preventDefault();
  setMessage('');

  const form = event.currentTarget;
  const payload = {
    guest_name: form.guest_name.value.trim(),
    guest_phone: form.guest_phone.value.trim().replace(/\D/g, ''),
    room_number: form.room_number.value,
    check_in_date: form.check_in_date.value,
    check_out_date: form.check_out_date.value
  };

  try {
    const res = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(payload)
    });

    if (res.status === 401) {
      window.location.href = '/login';
      return;
    }

    const data = await readJsonSafe(res);
    if (!res.ok) {
      setMessage((data && data.error) || 'Failed to create booking', 'error');
      return;
    }

    setMessage(`Booking #${data.id} created successfully`, 'success');
    form.reset();
    await loadBookings();
  } catch (_err) {
    setMessage('Network error while creating booking', 'error');
  }
}

async function onDeleteBooking(event) {
  const target = event.target;
  if (!target.matches('button[data-id]')) {
    return;
  }

  const id = target.getAttribute('data-id');
  const confirmed = window.confirm(`Delete booking #${id}?`);
  if (!confirmed) {
    return;
  }

  try {
    const res = await fetch(`/api/bookings/${id}`, {
      method: 'DELETE',
      credentials: 'same-origin'
    });

    if (res.status === 401) {
      window.location.href = '/login';
      return;
    }

    const data = await readJsonSafe(res);
    if (!res.ok) {
      setMessage((data && data.error) || 'Failed to delete booking', 'error');
      return;
    }

    setMessage('Booking deleted', 'success');
    await loadBookings();
  } catch (_err) {
    setMessage('Network error while deleting booking', 'error');
  }
}

async function initializeBookingsModule() {
  await window.DashboardLayout.mountDashboardLayout({
    activePage: 'bookings',
    contentHtml: `
      <section class="panel">
        <h1>Bookings</h1>
        <p class="subtitle">Create bookings and prevent room double-booking.</p>

        <form id="bookingForm" class="booking-form">
          <div class="field">
            <label for="guest_name">Guest Name</label>
            <input id="guest_name" name="guest_name" type="text" required />
          </div>

          <div class="field">
            <label for="guest_phone">Phone (10 digits)</label>
            <input id="guest_phone" name="guest_phone" type="text" inputmode="numeric" pattern="[0-9]{10}" maxlength="10" required />
          </div>

          <div class="field">
            <label for="room_number">Room</label>
            <select id="room_number" name="room_number" required>
              <option value="101">101</option>
              <option value="102">102</option>
              <option value="103">103</option>
            </select>
          </div>

          <div class="field">
            <label for="check_in_date">Check-In</label>
            <input id="check_in_date" name="check_in_date" type="date" required />
          </div>

          <div class="field">
            <label for="check_out_date">Check-Out</label>
            <input id="check_out_date" name="check_out_date" type="date" required />
          </div>

          <button class="btn btn-primary" type="submit">Create Booking</button>
        </form>

        <div id="bookingNotice" class="notice" aria-live="polite"></div>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Guest</th>
                <th>Phone</th>
                <th>Room</th>
                <th>Check-In</th>
                <th>Check-Out</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody id="bookingsBody"></tbody>
          </table>
        </div>
      </section>
    `
  });

  const form = document.getElementById('bookingForm');
  const tableBody = document.getElementById('bookingsBody');
  form.addEventListener('submit', onCreateBooking);
  tableBody.addEventListener('click', onDeleteBooking);

  try {
    await loadBookings();
  } catch (_err) {
    setMessage('Failed to load bookings', 'error');
  }
}

document.addEventListener('DOMContentLoaded', initializeBookingsModule);
