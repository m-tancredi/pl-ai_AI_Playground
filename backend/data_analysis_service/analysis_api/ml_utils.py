# analysis_api/ml_utils.py
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, OneHotEncoder, LabelEncoder
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline # Assicurati sia importato
from sklearn.impute import SimpleImputer
from sklearn.metrics import r2_score, mean_squared_error, mean_absolute_error, accuracy_score, precision_score, recall_score, f1_score, confusion_matrix

# Algoritmi Scikit-learn
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.preprocessing import PolynomialFeatures
from sklearn.tree import DecisionTreeRegressor, DecisionTreeClassifier
from sklearn.ensemble import RandomForestRegressor, RandomForestClassifier
from sklearn.svm import SVR, SVC
from sklearn.naive_bayes import GaussianNB


def preprocess_data(df, selected_features, selected_target, task_type):
    """
    Preprocessa il DataFrame per l'addestramento.
    Gestisce missing values, scaling (numeriche), encoding (categoriche).
    Restituisce X, y pronti per il training, e il preprocessor addestrato.
    """
    print(f"Preprocessing data. Features: {selected_features}, Target: {selected_target}, Task: {task_type}")

    X_df = df[selected_features].copy()
    y_series = df[selected_target].copy()

    # Identifica colonne numeriche e categoriche in X
    numeric_features = X_df.select_dtypes(include=np.number).columns.tolist()
    categorical_features = X_df.select_dtypes(include=['object', 'category']).columns.tolist()

    print(f"  Numeric features: {numeric_features}")
    print(f"  Categorical features: {categorical_features}")

    # Pipeline di preprocessing
    numeric_transformer = Pipeline(steps=[
        ('imputer', SimpleImputer(strategy='mean')), # Gestisci NaN con la media
        ('scaler', StandardScaler()) # Scala features numeriche
    ])

    categorical_transformer = Pipeline(steps=[
        ('imputer', SimpleImputer(strategy='most_frequent')), # Gestisci NaN con il più frequente
        ('onehot', OneHotEncoder(handle_unknown='ignore', sparse_output=False)) # One-hot encode
    ])

    # Crea il ColumnTransformer
    preprocessor = ColumnTransformer(
        transformers=[
            ('num', numeric_transformer, numeric_features),
            ('cat', categorical_transformer, categorical_features)
        ],
        remainder='passthrough' # Lascia altre colonne (se ce ne fossero) invariate
    )

    # Applica preprocessing a X
    X_processed = preprocessor.fit_transform(X_df)
    print(f"  X data processed. Shape: {X_processed.shape}")

    # Preprocessa y per la classificazione (Label Encoding)
    y_processed = y_series
    label_encoder = None # Per mappare indietro le predizioni
    if task_type == 'classification':
        # Verifica se y è già numerica o necessita encoding
        if y_series.dtype == 'object' or pd.api.types.is_categorical_dtype(y_series):
            label_encoder = LabelEncoder()
            y_processed = label_encoder.fit_transform(y_series)
            print(f"  Target column '{selected_target}' label encoded. Classes: {label_encoder.classes_}")
        elif not pd.api.types.is_numeric_dtype(y_series):
            raise ValueError(f"Target column '{selected_target}' for classification is not numeric or categorical.")
        # Assicurati che le etichette siano intere per la maggior parte dei classificatori
        y_processed = y_processed.astype(int)


    # Gestisci NaN nel target (prima del train/test split)
    if pd.Series(y_processed).isnull().any():
        print(f"  Warning: NaN values found in target column '{selected_target}'. Dropping rows.")
        # Crea un DataFrame temporaneo per allineare e droppare NaN
        temp_df = pd.DataFrame(X_processed)
        temp_df['target'] = y_processed
        temp_df.dropna(subset=['target'], inplace=True)
        if temp_df.empty:
            raise ValueError("All rows dropped due to NaNs in target. Cannot proceed.")
        X_processed = temp_df.drop(columns=['target']).values
        y_processed = temp_df['target'].values
        print(f"  Data shape after dropping NaNs in target: X={X_processed.shape}, y={y_processed.shape}")


    return X_processed, y_processed, preprocessor, label_encoder


# In ml_utils.py -> get_sklearn_model

def get_sklearn_model(algorithm_key, task_type, params=None):
    params = params or {}
    print(f"Initializing model for key: '{algorithm_key}', task: '{task_type}', params: {params}")

    # --- Mappatura per abbreviazioni comuni ---
    key_map = {
        "lr": "linear_regression", # Se usi questa abbreviazione
        "poly_reg": "polynomial_regression",
        "dt_reg": "decision_tree_regressor",
        "rf_reg": "random_forest_regressor",
        "log_reg": "logistic_regression",
        "dt_clf": "decision_tree_classifier", # Abbreviazione comune
        "dtc": "decision_tree_classifier",    # Aggiungi per 'dtc'
        "rf_clf": "random_forest_classifier",
        "nb_clf": "naive_bayes_classifier",   # Abbreviazione comune
        "nbc": "naive_bayes_classifier",      # Aggiungi per 'nbc'
        # Aggiungi altre mappature se necessario
    }
    # Usa la chiave mappata se esiste, altrimenti la chiave originale
    processed_key = key_map.get(algorithm_key.lower(), algorithm_key.lower())
    print(f"  Processed algorithm key: '{processed_key}'")
    # --- Fine Mappatura ---

    # Regression Models
    if processed_key == 'linear_regression':
        return LinearRegression(**params)
    elif processed_key == 'polynomial_regression':
        degree = params.get('degree', 2)
        return Pipeline([ ('poly', PolynomialFeatures(degree=degree, include_bias=False)), ('linear', LinearRegression()) ])
    elif processed_key == 'decision_tree_regressor':
        return DecisionTreeRegressor(random_state=42, **params)
    elif processed_key == 'random_forest_regressor':
        return RandomForestRegressor(random_state=42, n_jobs=-1, **params)
    elif processed_key == 'svr':
        return SVR(**params)

    # Classification Models
    elif processed_key == 'logistic_regression':
        return LogisticRegression(random_state=42, solver='liblinear', max_iter=params.get('max_iter', 100), **params) # Aggiunto max_iter
    elif processed_key == 'svc':
        return SVC(random_state=42, probability=True, **params)
    elif processed_key == 'decision_tree_classifier': # Usa processed_key
        return DecisionTreeClassifier(random_state=42, **params)
    elif processed_key == 'random_forest_classifier': # Usa processed_key
        return RandomForestClassifier(random_state=42, n_jobs=-1, **params)
    elif processed_key == 'naive_bayes_classifier': # Usa processed_key
        return GaussianNB(**params)
    else:
        raise ValueError(f"Unsupported algorithm_key: '{algorithm_key}' (processed as '{processed_key}')")

def calculate_regression_metrics(y_true, y_pred):
    return {
        "r2_score": r2_score(y_true, y_pred),
        "mse": mean_squared_error(y_true, y_pred),
        "mae": mean_absolute_error(y_true, y_pred),
        "rmse": np.sqrt(mean_squared_error(y_true, y_pred))
    }

# analysis_api/ml_utils.py

def calculate_classification_metrics(y_true, y_pred, y_pred_proba=None, all_class_labels_numeric=None, all_class_names=None):
    """
    Calcola metriche di classificazione.
    all_class_labels_numeric: Lista di TUTTI gli indici numerici unici possibili per le classi (es. [0, 1, 2]).
    all_class_names: Lista dei nomi di TUTTE le classi, nello stesso ordine degli indici numerici.
    """
    metrics = {
        "accuracy": accuracy_score(y_true, y_pred),
        "precision_macro": precision_score(y_true, y_pred, average='macro', zero_division=0),
        "recall_macro": recall_score(y_true, y_pred, average='macro', zero_division=0),
        "f1_macro": f1_score(y_true, y_pred, average='macro', zero_division=0),
    }

    # Determina le etichette effettive per la confusion matrix
    # Usa all_class_labels_numeric se fornito, altrimenti quelle presenti in y_true e y_pred
    if all_class_labels_numeric is None:
        current_labels = sorted(list(np.unique(np.concatenate((y_true, y_pred)))))
    else:
        current_labels = sorted(list(all_class_labels_numeric))


    if all_class_names and len(all_class_names) == 2 and len(current_labels) >=2 : # Metriche binarie (assicurati che 1 sia la classe positiva)
        # Trova quale etichetta numerica corrisponde alla classe "positiva" (spesso l'indice 1)
        # Questo presuppone che all_class_names[1] sia la classe positiva se y_true/y_pred sono 0 e 1
        positive_label_index = 1 # Assumiamo che 1 sia la classe positiva
        if positive_label_index in current_labels: # Controlla se la classe positiva è presente nei dati
             metrics["precision_binary"] = precision_score(y_true, y_pred, labels=current_labels, pos_label=positive_label_index, average='binary', zero_division=0)
             metrics["recall_binary"] = recall_score(y_true, y_pred, labels=current_labels, pos_label=positive_label_index, average='binary', zero_division=0)
             metrics["f1_binary"] = f1_score(y_true, y_pred, labels=current_labels, pos_label=positive_label_index, average='binary', zero_division=0)


    cm = confusion_matrix(y_true, y_pred, labels=current_labels).tolist()
    metrics["confusion_matrix"] = cm

    # Costruisci confusion_matrix_labels usando all_class_names e current_labels
    # Questo assicura che l'ordine corrisponda a quello della confusion_matrix
    if all_class_names:
        # Mappa gli indici numerici in current_labels ai nomi corrispondenti in all_class_names
        # Solo se l'indice è valido per all_class_names
        metrics["confusion_matrix_labels"] = [all_class_names[i] for i in current_labels if i < len(all_class_names)]
    else: # Fallback se all_class_names non è fornito
        metrics["confusion_matrix_labels"] = [f"Class {i}" for i in current_labels]


    # ROC AUC (richiede y_pred_proba)
    if y_pred_proba is not None and len(all_class_names or []) == 2 and len(current_labels) == 2:
        from sklearn.metrics import roc_auc_score
        try:
            # Assicurati che y_pred_proba sia (n_samples, n_classes)
            # e prendi le probabilità per la classe positiva (indice 1)
            metrics["roc_auc"] = roc_auc_score(y_true, y_pred_proba[:, 1])
        except Exception as roc_exc:
            print(f"Could not calculate ROC AUC: {roc_exc}")
            metrics["roc_auc"] = None

    return metrics
# --- Funzioni per Plot (Esempio con Plotly, da adattare) ---
# Queste funzioni genererebbero JSON per Plotly.js nel frontend


# ... (preprocess_data, get_sklearn_model, calculate_regression_metrics, calculate_classification_metrics come prima) ...

def generate_regression_plot_data(X_test_transformed, y_test, y_pred, model_trained, selected_feature_names_original, selected_target_name):
    """
    Prepara dati per lo scatter plot di regressione, includendo:
    1. Punti Actual vs. Predicted.
    2. Linea Ideale (y=x).
    3. Linea di Regressione effettiva del modello (se lineare o pipeline con lineare).
    X_test_transformed: Feature del test set già trasformate dal preprocessor (usate per la linea di regressione).
    y_test: Valori target veri del test set.
    y_pred: Valori target predetti dal modello sul test set.
    model_trained: Il modello Scikit-learn addestrato.
    selected_feature_names_original: Lista dei nomi delle feature originali selezionate.
    selected_target_name: Nome della colonna target originale.
    """
    plot_data = {
        "type": "regression_scatter",
        "data": {
            "actual_vs_predicted": [{"actual": float(yt), "predicted": float(yp)} for yt, yp in zip(y_test, y_pred)],
            "ideal_line": []
        },
        "layout": {
            "title": f"Regression: Actual vs. Predicted for {selected_target_name}",
            "xaxis_title": f"Actual {selected_target_name}",
            "yaxis_title": f"Predicted {selected_target_name}"
        }
    }

    # Calcola range per la linea ideale
    min_val = float(min(y_test.min(), y_pred.min()))
    max_val = float(max(y_test.max(), y_pred.max()))
    plot_data["data"]["ideal_line"] = [{"x": min_val, "y": min_val}, {"x": max_val, "y": max_val}]

    # --- Aggiungi Linea di Regressione Effettiva ---
    # Questo funziona meglio se X_test_transformed corrisponde a una singola feature originale (o se plottiamo contro di essa)
    # Se X_test_transformed ha molte feature, plottare la "linea" di regressione in 2D è una proiezione.
    # Per semplicità, se X_test_transformed ha una sola colonna (comune per plot 2D), la usiamo come asse x.
    
    regression_line_points = []
    try:
        # Controlla se il modello è lineare o una pipeline che termina con un modello lineare
        actual_estimator = model_trained
        if isinstance(model_trained, Pipeline):
            # Prendi l'ultimo step, che dovrebbe essere il regressore
            if hasattr(model_trained.named_steps, list(model_trained.named_steps.keys())[-1]):
                 actual_estimator = model_trained.steps[-1][1]


        if isinstance(actual_estimator, (LinearRegression)) and X_test_transformed.shape[1] > 0:
             # Per il plot, ordiniamo i valori di X per disegnare una linea continua
             # Se X_test_transformed ha più colonne, usiamo la prima per l'asse X del plot
             x_for_line_plot_transformed = X_test_transformed[:, 0]
             
             # Crea un range di valori X trasformati su cui predire la linea
             # Se abbiamo molte feature, questa è una semplificazione e plottiamo
             # la predizione rispetto alla prima feature trasformata.
             # Per una visualizzazione corretta di regressione multivariata, servirebbero plot parziali.
             
             # Ordina X per la linea
             sort_indices = np.argsort(x_for_line_plot_transformed)
             x_line_sorted_transformed = x_for_line_plot_transformed[sort_indices]
             
             # Se il preprocessor ha trasformato più feature, e vogliamo plottare vs la prima originale
             # e il modello è stato addestrato su più feature trasformate,
             # per predire la linea dobbiamo usare tutti gli input trasformati
             # Qui, per semplicità, se X_test_transformed ha più di una colonna,
             # prediciamo solo sulla base dei dati di test esistenti per la linea.
             if X_test_transformed.shape[1] == 1:
                 y_line_pred = model_trained.predict(x_line_sorted_transformed.reshape(-1, 1))
             else:
                 # Se multivariata, la "linea" è più complessa.
                 # Per il plot, possiamo mostrare le predizioni y_pred originali ordinate per una delle X
                 y_line_pred = y_pred[sort_indices] # Usa y_pred del test set, ma ordinate

             regression_line_points = [{"x": float(x_val), "y": float(y_val)} for x_val, y_val in zip(x_line_sorted_transformed, y_line_pred)]
             plot_data["data"]["regression_line"] = regression_line_points
             
             # Aggiorna titolo asse X se abbiamo il nome della feature originale e ne usiamo una sola
             if len(selected_feature_names_original) == 1 and X_test_transformed.shape[1] ==1 :
                 plot_data["layout"]["xaxis_title"] = selected_feature_names_original[0]
             elif X_test_transformed.shape[1] > 1:
                 plot_data["layout"]["xaxis_title"] = f"Feature 1 (Transformed)" # O nome più descrittivo

    except Exception as e:
        print(f"Could not generate regression line data: {e}")
        # Non fa fallire la generazione del plot, la linea sarà semplicemente omessa

    return plot_data

def generate_classification_plot_data(X_test_transformed, y_test_numeric, model, selected_feature_names_original, target_name, all_class_names, preprocessor, label_encoder):
    """
    Prepara dati per visualizzazione classificazione.
    Tenta uno scatter plot 3D se ci sono abbastanza feature numeriche,
    altrimenti un istogramma delle predizioni.
    X_test_transformed: Dati delle feature del test set GIÀ TRASFORMATI dal preprocessor.
    y_test_numeric: Etichette vere del test set (numeriche).
    selected_feature_names_original: Nomi delle feature originali (prima del preprocessing).
    """
    print(f"Generating plot data for classification. Original features: {selected_feature_names_original}")
    plot_data = {
        "type": "unknown", # Verrà impostato dopo
        "data": [],
        "layout": {}
    }

    # Identifica le feature numeriche originali tra quelle selezionate
    # Questo è un po' euristico. Idealmente, il preprocessor ci darebbe questa info.
    # Per ora, assumiamo che il preprocessor scali le numeriche e one-hot encodi le categoriche.
    # Se usiamo solo PCA o selezione feature, questo diventa più complesso.
    # Per semplicità, cerchiamo di prendere le prime 3 feature *trasformate*
    # se sono più di 3, e speriamo che corrispondano a quelle numeriche originali
    # o a componenti principali significativi.

    num_transformed_features = X_test_transformed.shape[1]
    y_pred_numeric = model.predict(X_test_transformed)

    if num_transformed_features >= 3:
        plot_data["type"] = "classification_scatter_3d"
        plot_data["layout"] = {
            "title": f"3D Scatter Plot of Predictions for {target_name}",
            "scene": { # Per grafici 3D
                "xaxis": {"title": f"Feature 1 (Transformed)"}, # Sarebbe meglio avere nomi originali qui
                "yaxis": {"title": f"Feature 2 (Transformed)"},
                "zaxis": {"title": f"Feature 3 (Transformed)"},
            },
            "margin": dict(l=0, r=0, b=0, t=40) # Margini più stretti
        }

        # Prendi le prime 3 componenti/feature trasformate per il plot
        x_plot = X_test_transformed[:, 0].tolist()
        y_plot = X_test_transformed[:, 1].tolist()
        z_plot = X_test_transformed[:, 2].tolist()

        # Colora i punti in base alla classe VERA e forma in base alla PREDETTA
        # O semplicemente colore per classe predetta/vera
        # Per ora, coloriamo per classe predetta per vedere i cluster del modello
        
        unique_predicted_labels = np.unique(y_pred_numeric)
        
        traces = []
        # Colori Plotly di default
        plotly_colors = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf']

        for i, label_numeric in enumerate(unique_predicted_labels):
            idx = (y_pred_numeric == label_numeric) # Indici dei punti predetti come questa classe
            
            class_name = ""
            if label_encoder and hasattr(label_encoder, 'classes_') and label_numeric < len(label_encoder.classes_):
                class_name = str(label_encoder.classes_[label_numeric])
            elif all_class_names and label_numeric < len(all_class_names):
                class_name = all_class_names[label_numeric]
            else:
                class_name = f"Class {label_numeric}"

            traces.append({
                "type": "scatter3d",
                "x": np.array(x_plot)[idx].tolist(),
                "y": np.array(y_plot)[idx].tolist(),
                "z": np.array(z_plot)[idx].tolist(),
                "mode": "markers",
                "name": f"Predicted: {class_name}",
                "marker": {
                    "size": 5,
                    "color": plotly_colors[i % len(plotly_colors)], # Cicla i colori
                    "opacity": 0.7
                }
            })
        plot_data["data"] = traces

    elif num_transformed_features == 2:
        # Implementa scatter plot 2D se vuoi
        plot_data["type"] = "classification_scatter_2d" # Placeholder
        plot_data["layout"] = { "title": "2D Scatter Plot (Not Implemented Yet)"}
        print("  2D scatter plot for classification not fully implemented yet, showing histogram instead.")
        # Fallback a istogramma se 2D non è pronto
        unique_labels, counts = np.unique(y_pred_numeric, return_counts=True)
        # ... (logica istogramma come prima) ...

    else: # Meno di 2 feature, usa istogramma
        plot_data["type"] = "classification_predictions_histogram"
        unique_labels, counts = np.unique(y_pred_numeric, return_counts=True)
        predicted_class_distribution = []
        # ... (logica istogramma come prima per popolare predicted_class_distribution) ...
        if label_encoder:
            labels_decoded = label_encoder.inverse_transform(unique_labels)
            predicted_class_distribution = [{"class": str(labels_decoded[i]), "count": int(counts[i])} for i in range(len(unique_labels))]
        else:
            predicted_class_distribution = [{"class": all_class_names[int(label)] if int(label) < len(all_class_names) else f"Class_{int(label)}", "count": int(counts[i])} for i,label in enumerate(unique_labels)]

        plot_data["data"] = predicted_class_distribution
        plot_data["layout"] = {
            "xaxis_title": "Predicted Class",
            "yaxis_title": "Count",
            "title": f"Distribution of Predicted Classes for {target_name}"
        }
    
    print(f"  Generated plot data of type: {plot_data['type']}")
    return plot_data

# analysis_api/ml_utils.py
# ... (altri import: pd, np) ...

def analyze_dataframe_for_potential_uses(df, sample_rows_limit=1000, cat_threshold_ratio=0.2, max_cat_sample=10):
    """
    Analizza un DataFrame per estrarre metadati e suggerire potential_uses.
    Restituisce un dizionario di metadati.
    """
    if df is None or df.empty:
        return {
            "num_rows": 0, "num_cols": 0, "headers": [], "column_types": {},
            "potential_uses": [], "sample_rows_preview": []
        }

    # Usa un campione per analisi dettagliata se il DF è grande
    df_sample = df.head(min(len(df), sample_rows_limit))

    metadata = {
        "num_rows": len(df), # Numero righe totali del DF fornito
        "num_cols": len(df.columns),
        "headers": list(df.columns),
        "column_types": {},
        "potential_uses": set(), # Usiamo un set per evitare duplicati
        "sample_rows_preview": df.head(10).to_dict(orient='records') # Preview per UI
    }

    numeric_cols = []
    categorical_cols = []
    datetime_cols = [] # Aggiungiamo per time_series

    for col in df_sample.columns:
        dtype_str = str(df_sample[col].dtype)
        metadata["column_types"][col] = dtype_str

        if pd.api.types.is_numeric_dtype(df_sample[col]):
            numeric_cols.append(col)
        elif pd.api.types.is_datetime64_any_dtype(df_sample[col]): # Controlla per datetime
            datetime_cols.append(col)
        elif pd.api.types.is_string_dtype(df_sample[col]) or pd.api.types.is_object_dtype(df_sample[col]):
            # Considera categorica se ha pochi valori unici rispetto al campione
            unique_vals = df_sample[col].nunique(dropna=False) # dropna=False per contare NaN come categoria
            if len(df_sample) > 0 and (unique_vals / len(df_sample) < cat_threshold_ratio) and unique_vals > 1 : # Deve avere almeno 2 categorie
                categorical_cols.append(col)
                if unique_vals <= max_cat_sample:
                    metadata.setdefault('sample_categories', {})[col] = df_sample[col].dropna().unique().tolist()

    print(f"  DataFrame Analysis - Numeric: {numeric_cols}, Categorical: {categorical_cols}, Datetime: {datetime_cols}")

    # Logica suggerimenti (simile a quella del task del resource manager)
    if len(numeric_cols) >= 2:
        metadata["potential_uses"].add("regression")
        metadata["potential_uses"].add("clustering") # Se ci sono almeno 2 numeriche
    if len(categorical_cols) >= 1 and (len(numeric_cols) >= 1 or len(categorical_cols) > 1): # Target categorico + almeno 1 altra feature
        metadata["potential_uses"].add("classification")
    if len(datetime_cols) >= 1 and len(numeric_cols) >= 1:
        metadata["potential_uses"].add("time_series")

    metadata["potential_uses"] = sorted(list(metadata["potential_uses"]))
    return metadata