import test from 'node:test';
import assert from 'node:assert/strict';
import { departmentKind } from './salesUtils.js';

test('accounts without a department can render the sidebar', () => {
  assert.equal(departmentKind(null), 'OTHER');
  assert.equal(departmentKind(undefined), 'OTHER');
  assert.equal(departmentKind(''), 'OTHER');
});

test('recognizes sales and receiving departments with Vietnamese names', () => {
  assert.equal(departmentKind(' Phòng Kinh Doanh '), 'SALES');
  assert.equal(departmentKind('Kế toán'), 'RECEIVER');
  assert.equal(departmentKind('Phòng Kỹ thuật'), 'RECEIVER');
  assert.equal(departmentKind('Nhân sự'), 'OTHER');
});
