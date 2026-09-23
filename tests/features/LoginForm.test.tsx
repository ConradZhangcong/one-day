import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { LoginForm } from '../../src/features/auth/AuthGate';
import { apiRequest, changedSession } from '../../src/features/auth/session';

vi.mock('../../src/features/auth/session', () => ({
  apiRequest: vi.fn(),
  changedSession: vi.fn(),
}));

it('shows field errors, focuses the first invalid input and submits corrected values', async () => {
  const user = userEvent.setup();
  render(<LoginForm />);
  await user.click(screen.getByRole('button', { name: '登录' }));
  const username = screen.getByLabelText('账号');
  const password = screen.getByLabelText('密码');
  expect(username).toHaveFocus();
  expect(username).toHaveAccessibleDescription('请输入账号');
  expect(password).toHaveAccessibleDescription('请输入密码');
  expect(apiRequest).not.toHaveBeenCalled();
  await user.type(username, 'a!');
  await user.type(password, 'short');
  expect(username).toHaveAccessibleDescription('账号需为 3–32 位字母、数字或下划线');
  expect(password).toHaveAccessibleDescription('密码需为 10–128 位');
  await user.clear(username);
  await user.type(username, 'demo_user');
  await user.type(password, '-password');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '登录' }));
  expect(apiRequest).toHaveBeenCalledWith(
    'login',
    expect.objectContaining({ username: 'demo_user', password: 'short-password' }),
  );
  expect(changedSession).toHaveBeenCalled();
});

it('clears errors when switching modes and allows retry after server failure', async () => {
  const user = userEvent.setup();
  render(<LoginForm />);
  await user.click(screen.getByRole('button', { name: '登录' }));
  await user.click(screen.getByRole('button', { name: '还没有账号？创建账号' }));
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  await user.type(screen.getByLabelText('账号'), 'demo_user');
  await user.type(screen.getByLabelText('密码'), 'demo-password');
  vi.mocked(apiRequest).mockRejectedValueOnce(
    new Error('此账号已被使用，请登录或更换账号'),
  );
  await user.click(screen.getByRole('button', { name: '注册并登录' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('此账号已被使用');
  expect(screen.getByRole('button', { name: '注册并登录' })).toBeEnabled();
  await user.type(screen.getByLabelText('账号'), '2');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
