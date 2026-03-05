import firebase_admin
from firebase_admin import credentials, messaging
import os
from datetime import datetime, timedelta
from models import get_session, UserToken, NotificationLog, MonitoringSite
from sqlalchemy import and_

class FCMService:
    def __init__(self, engine):
        self.engine = engine
        self.initialize_firebase()
    
    def initialize_firebase(self):
        """Initialize Firebase Admin SDK"""
        try:
            # Check if already initialized
            try:
                firebase_admin.get_app()
                print("✓ Firebase already initialized")
                self.firebase_enabled = True
                return
            except ValueError:
                # Not initialized, proceed
                pass
            
            cred_path = os.getenv('FIREBASE_SERVICE_ACCOUNT_PATH', 'firebase-service-account.json')
            if not os.path.exists(cred_path):
                print(f"⚠️  Firebase credentials not found at {cred_path}")
                self.firebase_enabled = False
                return
            
            cred = credentials.Certificate(cred_path)
            firebase_admin.initialize_app(cred)
            self.firebase_enabled = True
            print("✓ Firebase Admin SDK initialized")
        except Exception as e:
            print(f"⚠️  Firebase initialization failed: {e}")
            self.firebase_enabled = False
    
    def get_severity(self, aqi):
        """Determine alert severity from AQI"""
        if aqi >= 200:
            return 'critical'
        elif aqi >= 150:
            return 'high'
        else:
            return 'moderate'
    
    def should_notify(self, session, token_id, site_number, severity):
        """Check if notification should be sent (30min cooldown per site+severity)"""
        cooldown = timedelta(minutes=30)
        cutoff = datetime.utcnow() - cooldown
        
        # Check cooldown per site AND severity combination
        recent = session.query(NotificationLog).filter(
            and_(
                NotificationLog.token_id == token_id,
                NotificationLog.site_number == site_number,
                NotificationLog.severity == severity,  # ← Add this line
                NotificationLog.sent_at >= cutoff
            )
        ).first()
        
        return recent is None
    
    def send_notification(self, fcm_token, site_name, aqi, severity):
        """Send a single FCM notification"""
        if not self.firebase_enabled:
            return False
        
        emoji = {'critical': '🚨', 'high': '⚠️', 'moderate': '🔔'}.get(severity, '🔔')
        
        message = messaging.Message(
            data={
                'title': f'{emoji} High AQI Alert — {site_name}',
                'body': f'Current AQI is {aqi}. Air quality is unhealthy.',
                'site': site_name,
                'aqi': str(aqi),
                'severity': severity,
                'timestamp': datetime.utcnow().isoformat()
            },
            token=fcm_token
        )
        
        try:
            response = messaging.send(message)
            print(f"✓ Sent FCM to {site_name}: {response}")
            return True
        except Exception as e:
            print(f"✗ FCM send failed: {e}")
            return False
    
    def check_and_send_alerts(self):
        """Main alert checking loop - called by scheduler"""
        print("🔍 Running scheduled alert check...")
        
        if not self.firebase_enabled:
            print("⚠️  Firebase not enabled, skipping")
            return
        
        session = get_session(self.engine)
        
        try:
            # Get all active tokens
            tokens = session.query(UserToken).all()
            print(f"📱 Found {len(tokens)} registered tokens")
            
            if not tokens:
                print("⚠️  No tokens registered, skipping")
                return
            
            # Import here to avoid circular dependency
            from app import fetch_live_aqi
            
            # Check each site
            for site_num in range(1, 8):  # Sites 1-7
                print(f"🌍 Checking site {site_num}...")
                aqi_data = fetch_live_aqi(site_num)
                
                if not aqi_data:
                    print(f"  ⚠️  No AQI data for site {site_num}")
                    continue
                
                aqi = aqi_data['aqi']
                print(f"  📊 AQI: {aqi}")
                severity = self.get_severity(aqi)
                
                # Get site name
                site = session.query(MonitoringSite).filter(
                    MonitoringSite.site_number == site_num
                ).first()
                site_name = site.name if site else f"Site {site_num}"
                
                # Check each user token
                for token_record in tokens:
                    # Skip if site not monitored
                    if site_num not in token_record.monitored_sites:
                        continue
                    
                    # Skip if AQI below threshold
                    if aqi < token_record.aqi_threshold:
                        print(f"  ⏭️  AQI {aqi} < threshold {token_record.aqi_threshold}, skipping")
                        continue
                    
                    # Skip if severity not enabled
                    if severity == 'critical' and not token_record.notify_critical:
                        continue
                    if severity == 'high' and not token_record.notify_high:
                        continue
                    if severity == 'moderate' and not token_record.notify_moderate:
                        continue
                    
                    # Check cooldown
                    if not self.should_notify(session, token_record.id, site_num, severity):
                        print(f"  ⏰ Cooldown active for token {token_record.id}, site {site_num}")
                        continue
                    
                    print(f"  🔔 Sending notification to token {token_record.id}...")
                    
                    # Send notification
                    success = self.send_notification(
                        token_record.fcm_token,
                        site_name,
                        aqi,
                        severity
                    )
                    
                    if success:
                        # Log notification
                        log = NotificationLog(
                            token_id=token_record.id,
                            site_number=site_num,
                            aqi=aqi,
                            severity=severity
                        )
                        session.add(log)
                        session.commit()
                        print(f"  ✅ Notification sent successfully!")
            
            print("✓ Alert check complete")
            
        except Exception as e:
            print(f"❌ Error in alert checking: {e}")
            import traceback
            traceback.print_exc()
            session.rollback()
        finally:
            session.close()
