import { useState, useCallback } from 'react';
import { Button, Space, Typography, Input } from 'antd';
import { AudioOutlined, StopOutlined, ClearOutlined } from '@ant-design/icons';
import { useVoice } from '@/hooks/useVoice';

const { TextArea } = Input;
const { Text } = Typography;

interface VoiceInputProps {
  onTextChange?: (text: string) => void;
  onSubmit?: (text: string) => void;
  placeholder?: string;
}

export default function VoiceInput({
  onTextChange,
  onSubmit,
  placeholder = '点击开始录音...',
}: VoiceInputProps) {
  const { isListening, transcript, error, startListening, stopListening, clearTranscript } =
    useVoice();
  const [text, setText] = useState('');

  const handleTextChange = (value: string) => {
    setText(value);
    onTextChange?.(value);
  };

  const handleStart = () => {
    clearTranscript();
    setText('');
    startListening();
  };

  const handleStop = () => {
    stopListening();
    if (transcript) {
      setText(transcript);
      onTextChange?.(transcript);
    }
  };

  const handleClear = () => {
    clearTranscript();
    setText('');
    onTextChange?.('');
  };

  const handleSubmit = () => {
    const finalText = text || transcript;
    if (finalText) {
      onSubmit?.(finalText);
      handleClear();
    }
  };

  return (
    <div>
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <Space>
          {!isListening ? (
            <Button
              type="primary"
              icon={<AudioOutlined />}
              onClick={handleStart}
              size="large"
            >
              开始录音
            </Button>
          ) : (
            <Button
              danger
              icon={<StopOutlined />}
              onClick={handleStop}
              size="large"
            >
              停止录音
            </Button>
          )}
          <Button icon={<ClearOutlined />} onClick={handleClear}>
            清空
          </Button>
          {onSubmit && (
            <Button type="primary" onClick={handleSubmit} disabled={!text && !transcript}>
              提交
            </Button>
          )}
        </Space>

        {isListening && (
          <div style={{ padding: 8, background: '#f0f0f0', borderRadius: 4 }}>
            <Text type="secondary">正在录音...</Text>
          </div>
        )}

        {error && (
          <div style={{ padding: 8, background: '#fff2f0', borderRadius: 4 }}>
            <Text type="danger">{error}</Text>
          </div>
        )}

        <TextArea
          rows={4}
          placeholder={placeholder}
          value={text || transcript}
          onChange={(e) => handleTextChange(e.target.value)}
          disabled={isListening}
        />

        {transcript && !text && (
          <div style={{ padding: 8, background: '#f6ffed', borderRadius: 4 }}>
            <Text type="success">识别结果：{transcript}</Text>
          </div>
        )}
      </Space>
    </div>
  );
}

