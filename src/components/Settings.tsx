import React, {useState} from 'react';
import {View, ScrollView, Text, Switch} from 'react-native';
import {TrafficAssistTheme as theme} from '../theme/TrafficAssistTheme';
import {Card, Button, Header} from './StyledComponents';

interface SettingsProps {
  isVisible: boolean;
  onClose: () => void;
  settings: {
    notifications: boolean;
    highAccuracyMode: boolean;
    saveDetections: boolean;
    autoUpload: boolean;
    soundAlerts: boolean;
    vibrationFeedback: boolean;
    darkMode: boolean;
    dataCompression: boolean;
  };
  onSettingChange: (key: string, value: boolean) => void;
}

export const Settings: React.FC<SettingsProps> = ({
  isVisible,
  onClose,
  settings,
  onSettingChange,
}) => {
  if (!isVisible) return null;

  const SettingRow: React.FC<{
    title: string;
    description: string;
    value: boolean;
    onValueChange: (value: boolean) => void;
    icon?: string;
  }> = ({title, description, value, onValueChange, icon}) => (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: theme.spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
      }}>
      {icon && (
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: theme.colors.primary,
            marginRight: theme.spacing.md,
            justifyContent: 'center',
            alignItems: 'center',
          }}>
          <Text
            style={{
              color: theme.colors.textPrimary,
              fontSize: theme.typography.fontSize.lg,
            }}>
            {icon}
          </Text>
        </View>
      )}

      <View style={{flex: 1}}>
        <Text
          style={{
            color: theme.colors.textPrimary,
            fontSize: theme.typography.fontSize.md,
            fontWeight: theme.typography.fontWeight.medium,
            marginBottom: theme.spacing.xs,
          }}>
          {title}
        </Text>
        <Text
          style={{
            color: theme.colors.textSecondary,
            fontSize: theme.typography.fontSize.sm,
            lineHeight:
              theme.typography.lineHeight.normal * theme.typography.fontSize.sm,
          }}>
          {description}
        </Text>
      </View>

      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{
          false: theme.colors.surfaceLight,
          true: theme.colors.primary,
        }}
        thumbColor={value ? theme.colors.textPrimary : theme.colors.textMuted}
      />
    </View>
  );

  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: theme.colors.background,
        zIndex: 1000,
      }}>
      <Header
        title="Settings"
        subtitle="Customize your Traffic Assist experience"
        rightComponent={
          <Button title="Done" onPress={onClose} variant="primary" size="sm" />
        }
      />

      <ScrollView
        style={{flex: 1}}
        contentContainerStyle={{padding: theme.spacing.lg}}
        showsVerticalScrollIndicator={false}>
        {/* Detection Settings */}
        <Card variant="elevated" style={{marginBottom: theme.spacing.lg}}>
          <Text
            style={{
              color: theme.colors.textPrimary,
              fontSize: theme.typography.fontSize.lg,
              fontWeight: theme.typography.fontWeight.semibold,
              marginBottom: theme.spacing.md,
            }}>
            Detection Settings
          </Text>

          <SettingRow
            icon="🎯"
            title="High Accuracy Mode"
            description="Use advanced AI models for better detection accuracy. May reduce battery life."
            value={settings.highAccuracyMode}
            onValueChange={value => onSettingChange('highAccuracyMode', value)}
          />

          <SettingRow
            icon="💾"
            title="Save Detections"
            description="Save traffic light detections locally for analysis and improvement."
            value={settings.saveDetections}
            onValueChange={value => onSettingChange('saveDetections', value)}
          />

          <SettingRow
            icon="☁️"
            title="Auto Upload"
            description="Automatically upload detection data to improve the service for everyone."
            value={settings.autoUpload}
            onValueChange={value => onSettingChange('autoUpload', value)}
          />
        </Card>

        {/* Notification Settings */}
        <Card variant="elevated" style={{marginBottom: theme.spacing.lg}}>
          <Text
            style={{
              color: theme.colors.textPrimary,
              fontSize: theme.typography.fontSize.lg,
              fontWeight: theme.typography.fontWeight.semibold,
              marginBottom: theme.spacing.md,
            }}>
            Notifications & Alerts
          </Text>

          <SettingRow
            icon="🔔"
            title="Push Notifications"
            description="Receive notifications about traffic updates and system status."
            value={settings.notifications}
            onValueChange={value => onSettingChange('notifications', value)}
          />

          <SettingRow
            icon="🔊"
            title="Sound Alerts"
            description="Play audio alerts for traffic light changes and system notifications."
            value={settings.soundAlerts}
            onValueChange={value => onSettingChange('soundAlerts', value)}
          />

          <SettingRow
            icon="📳"
            title="Vibration Feedback"
            description="Use haptic feedback for traffic light state changes."
            value={settings.vibrationFeedback}
            onValueChange={value => onSettingChange('vibrationFeedback', value)}
          />
        </Card>

        {/* Appearance Settings */}
        <Card variant="elevated" style={{marginBottom: theme.spacing.lg}}>
          <Text
            style={{
              color: theme.colors.textPrimary,
              fontSize: theme.typography.fontSize.lg,
              fontWeight: theme.typography.fontWeight.semibold,
              marginBottom: theme.spacing.md,
            }}>
            Appearance
          </Text>

          <SettingRow
            icon="🌙"
            title="Dark Mode"
            description="Use dark theme for better visibility during night driving."
            value={settings.darkMode}
            onValueChange={value => onSettingChange('darkMode', value)}
          />
        </Card>

        {/* Data & Privacy */}
        <Card variant="elevated" style={{marginBottom: theme.spacing.lg}}>
          <Text
            style={{
              color: theme.colors.textPrimary,
              fontSize: theme.typography.fontSize.lg,
              fontWeight: theme.typography.fontWeight.semibold,
              marginBottom: theme.spacing.md,
            }}>
            Data & Privacy
          </Text>

          <SettingRow
            icon="📦"
            title="Data Compression"
            description="Compress uploaded data to save bandwidth. May affect processing speed."
            value={settings.dataCompression}
            onValueChange={value => onSettingChange('dataCompression', value)}
          />
        </Card>

        {/* About Section */}
        <Card variant="outlined" style={{marginBottom: theme.spacing.lg}}>
          <Text
            style={{
              color: theme.colors.textPrimary,
              fontSize: theme.typography.fontSize.lg,
              fontWeight: theme.typography.fontWeight.semibold,
              marginBottom: theme.spacing.md,
            }}>
            About Traffic Assist
          </Text>

          <View
            style={{
              paddingVertical: theme.spacing.sm,
              borderBottomWidth: 1,
              borderBottomColor: theme.colors.border,
            }}>
            <Text
              style={{
                color: theme.colors.textSecondary,
                fontSize: theme.typography.fontSize.sm,
                marginBottom: theme.spacing.xs,
              }}>
              Version
            </Text>
            <Text
              style={{
                color: theme.colors.textPrimary,
                fontSize: theme.typography.fontSize.md,
              }}>
              1.0.0 (Development)
            </Text>
          </View>

          <View
            style={{
              paddingVertical: theme.spacing.sm,
              borderBottomWidth: 1,
              borderBottomColor: theme.colors.border,
            }}>
            <Text
              style={{
                color: theme.colors.textSecondary,
                fontSize: theme.typography.fontSize.sm,
                marginBottom: theme.spacing.xs,
              }}>
              Environment
            </Text>
            <Text
              style={{
                color: theme.colors.textPrimary,
                fontSize: theme.typography.fontSize.md,
              }}>
              Development
            </Text>
          </View>

          <View
            style={{
              paddingVertical: theme.spacing.sm,
            }}>
            <Text
              style={{
                color: theme.colors.textSecondary,
                fontSize: theme.typography.fontSize.sm,
                marginBottom: theme.spacing.xs,
              }}>
              Last Updated
            </Text>
            <Text
              style={{
                color: theme.colors.textPrimary,
                fontSize: theme.typography.fontSize.md,
              }}>
              {new Date().toLocaleDateString()}
            </Text>
          </View>
        </Card>

        {/* Action Buttons */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginTop: theme.spacing.lg,
          }}>
          <Button
            title="Reset to Defaults"
            onPress={() => {
              Object.keys(settings).forEach(key => {
                onSettingChange(key, false);
              });
            }}
            variant="secondary"
            style={{flex: 1, marginRight: theme.spacing.sm}}
          />

          <Button
            title="Export Settings"
            onPress={() => {}}
            variant="primary"
            style={{flex: 1, marginLeft: theme.spacing.sm}}
          />
        </View>
      </ScrollView>
    </View>
  );
};
