import React, { useEffect, useMemo, useRef } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import theme from '../config/theme';

function TypingIndicator() {
  return (
    <View style={styles.typingBubble}>
      <View style={styles.typingDots}>
        <View style={[styles.dot, styles.dotFirst]} />
        <View style={[styles.dot, styles.dotSecond]} />
        <View style={[styles.dot, styles.dotThird]} />
      </View>
      <Text style={styles.typingText}>Echo sta pensando</Text>
    </View>
  );
}

export default function ChatLog({ messages = [], isThinking = false }) {
  const scrollRef = useRef(null);
  const renderableMessages = useMemo(() => messages || [], [messages]);

  useEffect(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd?.({ animated: true });
    });
  }, [renderableMessages.length, isThinking]);

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {renderableMessages.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Echo è online.</Text>
          <Text style={styles.emptySubtitle}>Parla oppure scrivi un comando.</Text>
        </View>
      ) : null}

      {renderableMessages.map((message, index) => {
        const isUser = message.role === 'user';
        return (
          <View
            key={`${message.role}-${index}-${message.content?.slice(0, 12) || 'msg'}`}
            style={[styles.bubble, isUser ? styles.userBubble : styles.assistantBubble]}
          >
            <Text style={[styles.messageText, isUser ? styles.userText : styles.assistantText]}>
              {message.content}
            </Text>
          </View>
        );
      })}

      {isThinking ? <TypingIndicator /> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  emptyState: {
    paddingVertical: theme.spacing.xxl,
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  emptyTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  emptySubtitle: {
    color: theme.colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
  },
  bubble: {
    maxWidth: '88%',
    borderRadius: theme.radii.lg,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderWidth: 1,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(139, 92, 246, 0.18)',
    borderColor: 'rgba(139, 92, 246, 0.3)',
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    borderColor: theme.colors.border,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 21,
  },
  userText: {
    color: '#f5f3ff',
  },
  assistantText: {
    color: theme.colors.text,
  },
  typingBubble: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    borderColor: theme.colors.border,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  typingDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: theme.colors.cyan,
    opacity: 0.92,
  },
  dotFirst: {
    opacity: 0.38,
  },
  dotSecond: {
    opacity: 0.68,
  },
  dotThird: {
    opacity: 0.98,
  },
  typingText: {
    color: theme.colors.textMuted,
    fontSize: 12,
  },
});
