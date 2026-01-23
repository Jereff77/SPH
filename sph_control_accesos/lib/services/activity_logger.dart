import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class ActivityLogger {
  static final ActivityLogger _instance = ActivityLogger._internal();

  factory ActivityLogger() {
    return _instance;
  }

  ActivityLogger._internal();

  Future<void> log(
    String activityType, {
    String? description,
    Map<String, dynamic>? metadata,
  }) async {
    try {
      final user = Supabase.instance.client.auth.currentUser;
      if (user == null) return;

      await Supabase.instance.client.from('activity_logs').insert({
        'uid': user.id,
        'activity_type': activityType,
        'description': description,
        'metadata': metadata ?? {},
        // created_at is automatic
      });
      
      if (kDebugMode) {
        print('Activity logged: $activityType - $description');
      }
    } catch (e) {
      // Fail silently to not disrupt user experience, but log to console
      debugPrint('Error logging activity: $e');
    }
  }
}
